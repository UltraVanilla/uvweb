import fs from "fs";
import toml from "@ltd/j-toml";

export interface BotConfig {
    alertsRole: string;
    activityChannel: string;
    modules: { [name: string]: BaseModuleConfiguration & any };
}

const botConfig: BotConfig = toml.parse(fs.readFileSync(process.argv[2] || "bot.toml", "utf8"), {
    bigint: false,
}) as unknown as BotConfig;

import * as discord from "discord.js";
import winston from "winston";

import { deferredPromise } from "../util";
import { BaseModuleConfiguration, BotModule } from "./bot-module";
import Activity from "./modules/Activity";
import SlurDetector from "./modules/SlurDetector";
import PingForwarder from "./modules/PingForwarder";
import ServerStarter from "./modules/ServerStarter";
import CategoryTimestamp from "./modules/CategoryTimestamp";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN as string;
// const TIMESTAMP_CATEGORIES = JSON.parse(process.env.TIMESTAMP_CATEGORIES!) as {
//     category: string;
//     timestamp: number;
//     text: string;
// }[];

const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
            if (info.module == null) return `${info.timestamp} ${info.level}: ${info.message}`;
            else return `${info.timestamp} ${info.level} from module ${info.module}: ${info.message}`;
        }),
    ),
    transports: [new winston.transports.Console()],
});

const client = new discord.Client({
    intents: [
        discord.GatewayIntentBits.Guilds,
        discord.GatewayIntentBits.GuildMessages,
        discord.GatewayIntentBits.MessageContent,
    ],
});

logger.info("logging into Discord...");
client.login(DISCORD_TOKEN);

client.once("ready", async () => {
    logger.info("successfully authenticated");
    const moduleClasses = [Activity, SlurDetector, PingForwarder, ServerStarter, CategoryTimestamp];

    const modules: { [name: string]: BotModule } = {};
    const { resolve, promise: modulesPromise } = deferredPromise<typeof modules>();

    for (const Module of moduleClasses) {
        const config = botConfig.modules[Module.name];
        // pass all modules back into the constructor, to allow for cross dependent modules
        // note: the constructor for each module is their loading point, `register` is extra behavior
        // that needs to be added onto the base class
        if (config.enabled) {
            modules[Module.name] = new Module(
                client,
                modulesPromise,
                botConfig,
                botConfig.modules[Module.name],
                logger.child({ module: Module.name }),
            );
        }
    }

    await Promise.all(Object.values(modules).map((module) => module.ready)).then(() => resolve(modules));
});
