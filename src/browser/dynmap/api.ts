import jQueryType from "jquery";
import Module, { BaseModuleConfiguration } from "./Module";

declare global {
    interface Window {
        jQuery: typeof jQueryType;
        $: typeof jQueryType;
        dynmap: any;
        map: any;
    }
}

export interface FrontendConfig {
    modules: { [name: string]: BaseModuleConfiguration & any };
}

export const frontendConfig: FrontendConfig = {
    modules: {
        NetherPortals: {
            enabled: true,
        },
    },
};

export interface Context {
    $: typeof jQueryType;
    dynmap: any;
    map: any;
}
