import * as discord from "discord.js";
import { BotModule, BaseModuleConfiguration } from "../bot-module";

export interface PingForwarderConfig extends BaseModuleConfiguration {
    rules: {
        [name: string]: {
            channels: string[];
            text: string;
        };
    };
}

export default class PingForwarder extends BotModule<PingForwarderConfig> {
    config!: PingForwarderConfig;

    readonly lastForwardPings: { [id: string]: Date } = {};

    async register(config: PingForwarderConfig) {
        this.config = config;
    }

    async onMessageCreate(message: discord.Message) {
        let alreadyCheckedForSpam = false;
        if (message.author.bot) return;

        outer: for (const role of message.mentions.roles.values()) {
            const pingForwardConfiguration = this.config.rules[role.name];
            if (pingForwardConfiguration != null) {
                const last = this.lastForwardPings[message.author.id];
                if (!alreadyCheckedForSpam && last != null && last.getTime() > Date.now() - 3 * 60 * 60 * 1000) {
                    const guildMember = message.guild!.members.cache.get(message.author.id);
                    try {
                        if (guildMember != null) await guildMember.timeout(3 * 60 * 60 * 1000);
                    } catch (err) {}
                    await message.reply(
                        "Muted for ping spam. Please do not ping any self-assign roles twice in 3 hours.",
                    );
                    break outer;
                }
                this.lastForwardPings[message.author.id] = new Date();
                alreadyCheckedForSpam = true;

                const link = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
                const forwardMessage = `${pingForwardConfiguration.text}, **@${role.name}** has been pinged in <#${message.channelId}>\n${link}`;
                for (const channelId of pingForwardConfiguration.channels) {
                    const channel = this.client.channels.cache.get(channelId) as discord.TextChannel;
                    if (message.channel.id === channelId) continue;
                    channel.send(forwardMessage);
                }
            }
        }
    }
}
