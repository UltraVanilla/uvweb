import * as discord from "discord.js";
import schedule from "node-schedule";
import winston from "winston";

import { BotConfig } from "./bot";

export interface BotModule<T extends BaseModuleConfiguration> {
    onMessageCreate?(message: discord.Message): void;
    onMessageDelete?(message: discord.Message | discord.PartialMessage): void;
    onMessageUpdate?(
        oldMessage: discord.Message | discord.PartialMessage,
        newMessage: discord.Message | discord.PartialMessage,
    ): void;
    onInteractionCreate?(interaction: discord.Interaction): void;
}

export abstract class BotModule<T extends BaseModuleConfiguration = BaseModuleConfiguration> {
    readonly logger: winston.Logger;
    readonly client: discord.Client;

    readonly jobs: JobConfiguration[] = [];
    readonly ready: Promise<void>;

    readonly globalConfig: BotConfig;

    readonly otherModules: Promise<{ [name: string]: BotModule<T> }>;

    listenersIgnoreSelf = true;

    constructor(
        client: discord.Client,
        otherModules: Promise<{ [name: string]: BotModule }>,
        globalConfig: BotConfig,
        moduleConfig: T,
        logger: winston.Logger,
    ) {
        logger.info("loading...");
        this.client = client;
        this.globalConfig = globalConfig;
        this.otherModules = otherModules;
        this.logger = logger;

        if (this.onMessageCreate != null)
            client.on("messageCreate", (message) => {
                if (this.listenersIgnoreSelf && message.author.id === client.user?.id) return;
                this.onMessageCreate!(message);
            });

        if (this.onMessageDelete != null)
            client.on("messageDelete", (message) => {
                if (message.author == null) return;
                if (this.listenersIgnoreSelf && message.author.id === client.user?.id) return;
                this.onMessageDelete!(message);
            });

        if (this.onMessageUpdate != null)
            client.on("messageUpdate", (oldMessage, newMessage) => {
                if (newMessage.author == null) return;
                if (this.listenersIgnoreSelf && newMessage.author.id === client.user?.id) return;
                this.onMessageUpdate!(oldMessage, newMessage);
            });

        if (this.onInteractionCreate != null)
            client.on("interactionCreate", (interaction) => {
                this.onInteractionCreate!(interaction);
            });

        this.ready = this.register(moduleConfig).then(() => {
            for (const job of this.jobs) {
                schedule.scheduleJob(job.schedule, job.job);
            }
            logger.info("finished loading");
        });
    }

    async register(_config: T) {}
}

export interface JobConfiguration {
    schedule: Parameters<typeof schedule.scheduleJob>[0];
    job: Parameters<typeof schedule.scheduleJob>[1];
}

export interface BaseModuleConfiguration {
    enabled: boolean;
}
