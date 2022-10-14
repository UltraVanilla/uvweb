import * as discord from "discord.js";
import { ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";

import { BotModule, BaseModuleConfiguration } from "../bot-module";

export interface ServerStarterConfig extends BaseModuleConfiguration {
    url: string;
    serverChatChannel: string;
    bridgeBotUser: string;
    roleWhitelist: string[];
    roleBlacklist: string[];
    whyNotWhitelisted: string;
}

export default class ServerStarter extends BotModule<ServerStarterConfig> {
    config!: ServerStarterConfig;

    serverChatChannel!: discord.TextChannel;
    listenersIgnoreSelf = false;

    async register(config: ServerStarterConfig) {
        this.config = config;
        this.serverChatChannel = this.client.channels.cache.get(this.config.serverChatChannel) as discord.TextChannel;

        if (this.config.bridgeBotUser === "self") this.config.bridgeBotUser = this.client.user!.id;
    }

    async onInteractionCreate(interaction: discord.Interaction) {
        if (!(interaction.isButton() && interaction.customId === "start_server")) return;
        if (interaction.member == null) return;

        const roles = (interaction.member.roles as discord.GuildMemberRoleManager).cache;
        const roleIds = Array.from(roles.keys());

        if (roleIds.some((role) => this.config.roleBlacklist.includes(role))) {
            // silently fail if user is blacklisted
        } else if (
            this.config.roleWhitelist.length === 0 ||
            !roleIds.some((role) => this.config.roleWhitelist.includes(role))
        ) {
            await interaction.reply({
                content: `<@${interaction.member?.user.id}> ${this.config.whyNotWhitelisted}`,
            });
        } else {
            let sentMessage = false;
            const attempt = async () => {
                try {
                    const response = await fetch(this.config.url as string);
                    if (response.status >= 200 && response.status < 300 && !sentMessage) {
                        sentMessage = true;
                        await interaction.reply({
                            content: `<@${interaction.member?.user.id}> Attempting to boot server, please wait...`,
                        });
                    }
                } catch (err) {
                    // silent fail
                }
            };

            // try to start server multiple times
            attempt();
            setTimeout(attempt, 1000 * 30);
            setTimeout(attempt, 1000 * 60);
            setTimeout(attempt, 1000 * 120);
            setTimeout(attempt, 1000 * 240);
            setTimeout(attempt, 1000 * 480);
            setTimeout(attempt, 1000 * 960);
        }
    }

    async onMessageCreate(message: discord.Message) {
        if (
            message.author.id === this.config.bridgeBotUser &&
            (message.content === ":octagonal_sign: **Server has stopped**" ||
                message.content === "🛑 **Server has stopped**")
        ) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("start_server")
                    .setLabel("Start Creative Server")
                    .setStyle(ButtonStyle.Success),
            );

            message.reply({
                content: "**Start creative server?**",
                components: [row as any],
            });
        }

        // const row = new ActionRowBuilder().addComponents(
        //     new ButtonBuilder().setCustomId("primary").setLabel("Primary").setStyle(ButtonStyle.Primary),
        // );
        //
        // await message.reply({ content: "Pong!", components: [row as any] });
    }
}
