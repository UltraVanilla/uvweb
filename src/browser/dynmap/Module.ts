import { Context } from "./api";

export default abstract class Module<T extends BaseModuleConfiguration = BaseModuleConfiguration> {
    readonly otherModules: Promise<{ [name: string]: Module<T> }>;
    readonly ready: Promise<void>;

    constructor(otherModules: Promise<{ [name: string]: Module }>, config: T, ctx: Context) {
        console.info(`loading module...`);
        this.otherModules = otherModules;
        this.ready = this.stage0(config);
    }

    async stage0(config: T): Promise<void> {}
    async stage1(): Promise<void> {}
    async stage2(): Promise<void> {}
}

export interface BaseModuleConfiguration {
    enabled: boolean;
}
