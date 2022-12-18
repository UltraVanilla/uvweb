import * as discord from "discord.js";
import { BotModule, BaseModuleConfiguration } from "../bot-module";
import ClonedMessage from "../../model/ClonedMessage";

export interface MirrorForumsToChannelConfig extends BaseModuleConfiguration {
    forumsChannel: string;
    destinationChannel: string;
}

export default class MirrorForumsToChannel extends BotModule<MirrorForumsToChannelConfig> {
    config!: MirrorForumsToChannelConfig;

    forumsChannel!: discord.ForumChannel;
    destinationChannel!: discord.TextChannel;

    async register(config: MirrorForumsToChannelConfig) {
        this.config = config;
        this.forumsChannel = this.client.channels.cache.get(this.config.forumsChannel) as discord.ForumChannel;
        this.destinationChannel = this.client.channels.cache.get(this.config.destinationChannel) as discord.TextChannel;
    }

    generateMessage(original: discord.Message): discord.MessageCreateOptions | discord.MessageEditOptions {
        if (!original.channel.isThread()) throw new Error("channel is not a thread");

        return {
            content:
                `**Message Link:** https://discord.com/channels/${original.guildId}/${original.channelId}/${original.id}\n` +
                `**Thread:** ${original.channel.name}\n` +
                `**User:** <@${original.author.id}> / ${original.author.username}#${original.author.discriminator}\n` +
                `${original.content}`,
            embeds: original.embeds,
            files: original.attachments.map((val) => val),
            allowedMentions: { users: [] },
        };
    }

    async onMessageUpdate(
        oldMessage: discord.Message | discord.PartialMessage,
        newMessage: discord.Message | discord.PartialMessage,
    ) {
        if (newMessage.channel.isThread()) {
            if (newMessage.channel.parentId === this.config.forumsChannel) {
                const existing = await ClonedMessage.query().findOne("src_message_id", newMessage.id);
                if (existing != null) {
                    const destChannel = this.client.channels.cache.get(existing.destChannelId);
                    if (destChannel == null || !(destChannel instanceof discord.TextChannel)) return;
                    const existingMessage = await destChannel.messages.fetch(existing.destMessageId);
                    if (existingMessage == null || !(existingMessage instanceof discord.Message)) return;
                    existingMessage.edit(this.generateMessage(newMessage as discord.Message<boolean>));
                }
            }
        }
    }
    async onMessageDelete(message: discord.Message | discord.PartialMessage) {
        if (message.channel.isThread()) {
            if (message.channel.parentId === this.config.forumsChannel) {
                const existing = await ClonedMessage.query().findOne("src_message_id", message.id);
                if (existing != null) {
                    const destChannel = this.client.channels.cache.get(existing.destChannelId);
                    if (destChannel == null || !(destChannel instanceof discord.TextChannel)) return;
                    const existingMessage = await destChannel.messages.fetch(existing.destMessageId);
                    if (existingMessage == null) return;
                    existingMessage.delete();
                }
            }
        }
    }
    async onMessageCreate(message: discord.Message) {
        if (message.channel.isThread()) {
            if (message.channel.parentId === this.config.forumsChannel) {
                let replyTo: discord.Message | void = undefined;

                if (message.mentions.repliedUser != null) {
                    const existing = await ClonedMessage.query().findOne(
                        "src_message_id",
                        message.reference!.messageId!,
                    );
                    if (existing != null) {
                        const destChannel = this.client.channels.cache.get(existing.destChannelId);
                        if (destChannel == null || !(destChannel instanceof discord.TextChannel)) return;
                        const existingMessage = await destChannel.messages.fetch(existing.destMessageId);
                        if (existingMessage == null) return;
                        replyTo = existingMessage;
                    }
                }

                const newMessage = await this.destinationChannel.send({
                    ...this.generateMessage(message),
                    reply: { messageReference: replyTo != null ? replyTo : null },
                } as discord.MessageCreateOptions);

                await ClonedMessage.query().upsertGraph(
                    {
                        srcChannelId: message.channel.id,
                        srcMessageId: message.id,
                        destChannelId: newMessage.channel.id,
                        destMessageId: newMessage.id,
                    },
                    { insertMissing: true },
                );
            }
        }
    }
}
