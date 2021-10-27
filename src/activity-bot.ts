import dotenv from "dotenv";
import CoreProtectSession from "./model/CoreProtectSession";
import * as discord from "discord.js";
import schedule from "node-schedule";

dotenv.config();

const client = new discord.Client({
    intents: [discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_MESSAGES],
});

client.login(process.env.DISCORD_TOKEN);

client.once("ready", async () => {
    const activityChannel = client.channels.cache.get(process.env.ACTIVITY_CHANNEL as string) as discord.TextChannel;

    let fetched;
    do {
        fetched = await activityChannel.messages.fetch({ limit: 100 });
        try {
            activityChannel.bulkDelete(fetched);
        } catch (err) {}
    } while (fetched.size >= 2);

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
                `**${session.username}** <t:${timestamp}> (<t:${timestamp}:R>)` +
                    ` \`\`\`/co l time:7d user:${session.username} action:container\n/co l time:7d user:${session.username} action:block\`\`\``,
            );
            alreadyInChannel.set(session.username, { session, message });
        }
    }

    schedule.scheduleJob("*/5 * * * *", job);
    await job();
});

async function getLatestSessions() {
    const sessions = await CoreProtectSession.query()
        .where("time", ">", (Date.now() - 1000 * 60 * 60 * 24 * 7) / 1000)
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
