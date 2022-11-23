import Module, { BaseModuleConfiguration } from "./Module";
import jsPanel from "jspanel4/dist/jspanel";

import jQueryType from "jquery";
import * as utils from "./utils";

declare global {
    interface Window {
        jQuery: typeof jQueryType;
        $: typeof jQueryType;
        dynmap: any;
        map: any;
    }
}

export interface NetherPortalsConfig extends BaseModuleConfiguration {
    
}

export const defaultConfig: NetherPortalsConfig = {
    enabled: true,
}

export default class NetherPortals extends Module<NetherPortalsConfig> {
    config!: NetherPortalsConfig;

    async stage0(config: NetherPortalsConfig) {
        this.config = config;
        console.info("Loading NetherPortals stage1");
        $(".tools-nether-portal").click(() => {
            const coords = utils.getCenterCoords();

            if (window.dynmap.world.name === "world_nether") {
                coords.world = window.dynmap.worlds.world;
                coords.x *= 8;
                coords.z *= 8;
            } else {
                coords.world = window.dynmap.worlds.world_nether;
                coords.x /= 8;
                coords.z /= 8;
            }

            window.dynmap.panToLocation(coords);
        });

    }
    async stage1() {
    }
    async stage2() {
    }
}
