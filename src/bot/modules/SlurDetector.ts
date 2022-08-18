import * as discord from "discord.js";
import { BotModule, BaseModuleConfiguration } from "../bot-module";

export interface SlurDetectorConfig extends BaseModuleConfiguration {
    detectionCategories: {
        name: string;
        notes?: string;
        matches: string[];
    }[];
}

interface DetectionCategory {
    name: string;
    notes?: string;
    matches: RegExp[];
}

export default class SlurDetector extends BotModule<SlurDetectorConfig> {
    config!: SlurDetectorConfig;
    detectionCategories!: DetectionCategory[];

    activityChannel!: discord.TextChannel;

    async register(config: SlurDetectorConfig) {
        this.config = config;
        this.globalConfig.alertsRole;
        this.activityChannel = this.client.channels.cache.get(this.globalConfig.activityChannel) as discord.TextChannel;

        // parse the regexes
        this.detectionCategories = this.config.detectionCategories.map((category) => ({
            ...category,
            matches: category.matches.map((regex) => new RegExp(regex)),
        }));
    }
    async onMessageCreate(message: discord.Message) {
        for (const category of this.config.detectionCategories) {
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

                await this.activityChannel.send(
                    `<@&${this.globalConfig.alertsRole}>` +
                        `\n**Type:** Message detection (5c381b3d)` +
                        `\n**Detection category:** ${category.name}` +
                        (category.notes != null ? `\n**Detection category notes:** ${category.notes}` : "") +
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
    }
}
