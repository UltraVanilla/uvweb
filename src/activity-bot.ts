import dotenv from "dotenv";
import CoreProtectSession from "./model/CoreProtectSession";
import * as discord from "discord.js";
import schedule from "node-schedule";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN as string;
const ACTIVITY_CHANNEL = process.env.ACTIVITY_CHANNEL as string;
const ALERTS_ROLE = process.env.ALERTS_ROLE as string;
const PING_FORWARD = JSON.parse(process.env.PING_FORWARD!) as { [name: string]: { channels: string[]; text: string } };

const detectionCategories = [
    {
        name: "Racism",
        matches: [
            /\b(s[a4]nd)?n[il41]g{1,2}(l[e3]t|[e3]r|[a4]|n[o0]g)?s?\b/,
            /\bbeaners?\b/,
            /\bc[o0]{2}ns?\b/,
            /\bch[i1l]nks?\b/,
            /\bnegro[id]{0,2}s?\b/,
        ],
    },
    {
        name: "Homophobia",
        matches: [/f[a@4](g{1,2}|qq)([e3il1o0]t{1,2}(ry|r[i1l]e)?)?s?\b/, /\bcock ?suckers?\b/, /\bdykes?\b/],
    },
    {
        name: "Transphobia",
        matches: [/\btr[a4]n{1,2}([i1l][e3]|y|[e3]r)s?\b/, /\bshemales?\b/],
    },
    {
        name: "Mysogyny",
        matches: [/\bslut\w*\b/, /\bwhore\w*\b/],
    },
    {
        name: "Ableism",
        matches: [/\bretards?\b/],
    },
    {
        name: "Religious Bigotry",
        matches: [
            /\bk[il1y]k[e3](ry|rie)?s?\b/,
            /\bjew(boy|let|bacca)s?\b/,
            /\b(rag|towel)heads?\b/,
            /\bgoat ?fuckers?\b/,
            /\bsodomites?\b/,
        ],
    },
];

const lastForwardPings: { [id: string]: Date } = {};

const client = new discord.Client({
    intents: [discord.GatewayIntentBits.Guilds, discord.GatewayIntentBits.GuildMessages],
});

// const { Client, GatewayIntentBits } = require("discord.js");
// const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.login(DISCORD_TOKEN);

client.once("ready", async () => {
    const activityChannel = client.channels.cache.get(ACTIVITY_CHANNEL) as discord.TextChannel;

    client.on("messageCreate", async (message) => {
        if (message.author.id === client.user?.id) return;

        for (const role of message.mentions.roles.values()) {
            const pingForwardConfiguration = PING_FORWARD[role.name];
            if (pingForwardConfiguration != null) {
                if (!message.author.bot) {
                    const last = lastForwardPings[message.author.id];
                    if (last != null && last.getTime() > Date.now() - 3 * 60 * 60 * 1000) {
                        const guildMember = message.guild!.members.cache.get(message.author.id);
                        try {
                            if (guildMember != null) await guildMember.timeout(3 * 60 * 60 * 1000);
                        } catch (err) {}
                        message.reply(
                            "Muted for ping spam. Please do not ping any self-assign roles twice in 3 hours.",
                        );
                    }
                    lastForwardPings[message.author.id] = new Date();
                }

                const link = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
                const forwardMessage = `${pingForwardConfiguration.text}, **@${role.name}** has been pinged in <#${message.channelId}>\n${link}`;
                for (const channelId of pingForwardConfiguration.channels) {
                    const channel = client.channels.cache.get(channelId) as discord.TextChannel;
                    if (message.channel.id === channelId) continue;
                    channel.send(forwardMessage);
                }
            }
        }

        for (const category of detectionCategories) {
            for (const regex of category.matches) {
                const content = message.content
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));

                const match = content.match(regex);
                if (match == null) continue;

                const rawTimestamp = message.createdTimestamp;
                const timestamp = Math.floor(rawTimestamp / 1000);

                const contentHighlighted = content.replace(match[0], `**${match[0]}**`);

                const contentsQuoted = contentHighlighted
                    .replaceAll("http", "hxxp")
                    .replaceAll(".", " . ")
                    .split("\n")
                    .map((contents) => `> "${contents}"`)
                    .join("\n");

                const lineNumber = content.slice(0, match.index).match(/\n/g)?.length || 0;
                const actualLine = content.split("\n")[lineNumber];

                const commandIssuer = actualLine.match(/ ([^ ]+) issued server command/)?.[1];
                const consoleUsername = actualLine.match(/\[.+\] <([^ ]+)>/)?.[1];
                const chatUsername = actualLine.match(/([^ ]+) »/)?.[1];

                const trueUsername = commandIssuer || consoleUsername || chatUsername;

                await activityChannel.send(
                    `<@&${ALERTS_ROLE}>` +
                        `\n**Type:** Message detection (5c381b3d)` +
                        `\n**Detection category:** ${category.name}` +
                        `\n**Sender:** <@${message.author.id}> / ${message.author.username}#${message.author.discriminator}` +
                        (trueUsername != null ? `\n**Possible true username:** ${trueUsername}` : "") +
                        `\n**Timestamp:** <t:${timestamp}> / <t:${timestamp}:R> / ${rawTimestamp}` +
                        `\n**Channel:** <#${message.channelId}>` +
                        `\n**Contents:** (canonicalized to remove links and special characters)` +
                        `\n${contentsQuoted}` +
                        `\n**Permalink:** https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`,
                );
            }
        }
    });

    let fetched;
    do {
        fetched = await activityChannel.messages.fetch({ limit: 100 });
        for (const message of fetched) {
            await message[1].delete();
        }
    } while (fetched.size > 0);

    const alreadyInChannel = new Map();

    async function job() {
        const sessions = await getLatestSessions();
        for (var i = sessions.length - 1; i >= 0; i--) {
            const session = sessions[i];

            const existing = alreadyInChannel.get(session.username);
            if (existing != null) {
                if (existing.session.time.getTime() === session.time.getTime()) {
                    continue;
                } else {
                    await existing.message.delete();
                }
            }

            const timestamp = session.time.getTime() / 1000;

            const message = await activityChannel.send(
                `**Type:** Player leave or join (3e3817dc)` +
                    `\n**${session.username}** <t:${timestamp}> (<t:${timestamp}:R>)` +
                    ` \`\`\`/co l time:7d user:${session.username} action:container\n/co l time:7d user:${session.username} action:block\`\`\``,
            );
            alreadyInChannel.set(session.username, { session, message });
        }
    }

    schedule.scheduleJob("*/5 * * * *", job);
    job();
});

async function getLatestSessions() {
    const sessions = await CoreProtectSession.query()
        .where("time", ">", (Date.now() - 1000 * 60 * 60 * 24 * 30) / 1000)
        .orderBy("rowid", "desc")
        .withGraphFetched("userAccount");

    let seenList = sessions.map((session) => ({ time: session.time as Date, username: session.userAccount.user }));

    const seenUsernameList = new Set();

    seenList = seenList.filter((entry) => {
        if (seenUsernameList.has(entry.username)) {
            return false;
        } else {
            seenUsernameList.add(entry.username);
            return true;
        }
    });

    return seenList;
}
