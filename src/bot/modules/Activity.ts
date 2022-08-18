import * as discord from "discord.js";
import { BotModule, BaseModuleConfiguration } from "../bot-module";
import CoreProtectSession from "../../model/CoreProtectSession";
import ActivityChannelMessage from "../../model/ActivityChannelMessage";

export interface ActivityConfig extends BaseModuleConfiguration {
    wipeEntireChannel: boolean;
    lookBackFirstRun: number;
}

export default class Activity extends BotModule<ActivityConfig> {
    config!: ActivityConfig;
    readonly jobs = [{ schedule: "*/5 * * * *", job: this.job5Minutes.bind(this) }];

    activityChannel!: discord.TextChannel;

    printingInProgress: boolean = false;

    async register(config: ActivityConfig) {
        this.config = config;
        this.activityChannel = this.client.channels.cache.get(this.globalConfig.activityChannel) as discord.TextChannel;

        if (this.config.wipeEntireChannel) {
            await ActivityChannelMessage.query().delete();
            let fetched;
            do {
                fetched = await this.activityChannel.messages.fetch({ limit: 100 });
                for (const message of fetched) {
                    await message[1].delete();
                }
            } while (fetched.size > 0);
        }
        this.job5Minutes(true);
    }

    async job5Minutes(firstRun = false) {
        if (this.printingInProgress) return;
        this.printingInProgress = true;

        const sessions = await getLatestSessions(firstRun ? this.config.lookBackFirstRun : 1200);
        for (var i = sessions.length - 1; i >= 0; i--) {
            const session = sessions[i];

            await ActivityChannelMessage.transaction(async (trx) => {
                const existing = await ActivityChannelMessage.query(trx).findOne("uuid", session.uuid);

                if (existing != null) {
                    if (existing.time.getTime() === session.time.getTime()) {
                        return;
                    } else {
                        try {
                            const existingMessage = await this.activityChannel.messages.fetch(existing.messageId);
                            if (existingMessage != null) await existingMessage.delete();
                        } catch (err) {
                            // if message is already deleted in discord, fail silently
                        }
                    }
                }

                const timestamp = session.time.getTime() / 1000;

                const message = await this.activityChannel.send(
                    `**Type:** Player leave or join (3e3817dc)` +
                        `\n**${session.username}** <t:${timestamp}> (<t:${timestamp}:R>)` +
                        ` \`\`\`/co l time:7d user:${session.username} action:container\n/co l time:7d user:${session.username} action:block\`\`\``,
                );
                await ActivityChannelMessage.query(trx).upsertGraph(
                    {
                        time: session.time,
                        uuid: session.uuid,
                        messageId: message.id,
                    },
                    { insertMissing: true },
                );
            }).catch((err) => {
                console.error(err);
            });
        }
        this.printingInProgress = false;
    }
}
async function getLatestSessions(time: number) {
    const sessions = await CoreProtectSession.query()
        .where("time", ">", (Date.now() - 1000 * time) / 1000)
        .orderBy("rowid", "desc")
        .withGraphFetched("userAccount");

    let seenList = sessions.map((session) => ({
        time: session.time as Date,
        username: session.userAccount.user,
        uuid: session.userAccount.uuid,
    }));

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
