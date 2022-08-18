import * as discord from "discord.js";

import { BotModule, BaseModuleConfiguration } from "../bot-module";

export interface CategoryTimestampConfig extends BaseModuleConfiguration {
    category: string;
    template: string;
    final: string;
    time: Date;
}
const CLOCKS = ["🕒", "🕕", "🕘", "🕛"];

export default class CategoryTimestamp extends BotModule<CategoryTimestampConfig> {
    config!: CategoryTimestampConfig;
    readonly jobs = [{ schedule: "*/15 * * * *", job: this.job15Minutes.bind(this) }];

    category!: discord.CategoryChannel;
    inactive = false;

    async register(config: CategoryTimestampConfig) {
        this.config = config;
        const category = this.client.channels.cache.get(this.config.category);
        if (!(category instanceof discord.CategoryChannel)) throw new Error("Channel must be a category");
        this.category = category;
        await this.job15Minutes(true);
    }
    async job15Minutes(_firstRun = false) {
        if (this.inactive) return;

        let duration = this.config.time.getTime() - Date.now();
        if (duration < 0) {
            await this.category.setName(this.config.final);
            this.inactive = true;
        } else {
            const days = Math.floor(duration / 86400000);
            let remaining = duration % 86400000;
            const hours = remaining / 3600000;

            const clock = CLOCKS[Math.floor(4 * (hours % 1.0))];

            let warningSymbol = "";
            if (days < 1 && hours <= 12) warningSymbol = "❗❗";
            else if (days < 3) warningSymbol = "❗";

            const name = this.config.template.replace(
                "###",
                `${warningSymbol}${clock} ` + (days === 0 ? `${hours.toFixed(1)}h` : `${days}d ${Math.floor(hours)}h`),
            );

            await this.category.setName(name);
        }
    }
}
