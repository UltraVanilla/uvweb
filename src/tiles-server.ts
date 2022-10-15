import { EventEmitter, once } from "events";
import TypedEmitter from "typed-emitter";

import Koa from "koa";

import LRUCache from "lru-cache";

import level, { levelUtils } from "./leveldb";

import { sleep } from "./util";
import DmMap from "./model/DmMap";
import DmTile from "./model/DmTile";
import * as api from "./auth/auth-api";

import { encode, extractStrings } from "./codecs/dynmap-update-ping";

const TILE_FORMATS = ["image/png", "image/jpeg", "image/webp"];
const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_WEEK_MS = ONE_WEEK * 1000;

const mapCache: LRUCache<string, DmMap> = new LRUCache({
    ttl: 1000 * 60 * 60 * 2,
    max: 1000,
});

const tileCache: LRUCache<string, DmTile> = new LRUCache({
    max: 1000,
});

const worldUpdateCachers = new Map();

export async function getMap(match: { worldID: string; mapID: string }): Promise<DmMap> {
    const cacheKey = `${match.worldID},${match.mapID}`;
    const cached = mapCache.get(cacheKey);
    if (cached != null) return cached;

    const map = await DmMap.query().findOne(match);

    if (map != null) mapCache.set(cacheKey, map);

    return map!;
}

export const tileServer = async (ctx: Koa.Context): Promise<void> => {
    const { worldID, mapID, coords } = ctx.params;

    const cacheId = `tile:${worldID}:${mapID}:${coords.match(/[^\.]*/)}`;

    let tile = tileCache.get(cacheId);
    if (tile == null) {
        const map = await getMap({ worldID, mapID });

        if (map == null) ctx.throw(404);

        const matches = coords.match(/(z+)?_?([-+]?[0-9]+)_([-+]?[0-9]+)/);

        const zoom = (matches[1] || "").length;
        const x = parseInt(matches[2]);
        const y = parseInt(matches[3]);

        tile = await map.$relatedQuery("tiles").findOne({ x, y, zoom });

        if (tile == null) ctx.throw(404);

        tileCache.set(cacheId, tile);
    }

    const roundedDate = new Date(Math.floor(tile.lastUpdate.getTime() / 1000) * 1000);

    ctx.type = TILE_FORMATS[tile.format] || "image/png";
    ctx.lastModified = roundedDate;
    ctx.set("Cache-Control", "public, must-revalidate, max-age=0");

    if (ctx.headers["if-modified-since"] != null && new Date(ctx.headers["if-modified-since"]) >= roundedDate) {
        ctx.throw(304);
    } else {
        ctx.body = tile.newImage || tile.image;
    }
};

let lastDictionaryUpdate = 0;

export const worldUpdates = async (ctx: Koa.Context): Promise<void> => {
    const { world, time } = ctx.params;

    const ping = (await (
        await fetch(`${process.env.DYNMAP_BACKEND!}up/world/${world}/${time}`, {})
    ).json()) as api.DynmapPing;

    let curDate = Date.now();
    if (curDate - lastDictionaryUpdate > 1000 * 60 * 3) {
        lastDictionaryUpdate = curDate;
        process.nextTick(async () => {
            for (const str of extractStrings(ping)) {
                let seenCount = 0;
                try {
                    seenCount = await level.get(`dictionary-string:${str}`, {
                        ttl: ONE_WEEK_MS,
                        valueEncoding: "json",
                    });
                } catch (err) {
                    if (!err.notFound) throw err;
                }
                await level.put(`dictionary-string:${str}`, seenCount + 1, { ttl: ONE_WEEK_MS });
            }
        });
    }

    const dictionary = await getDictionary(time);

    const bin = encode(ping, dictionary);

    ctx.body = Buffer.from(bin);
};

let dicts: { [time: number]: string[] } = {};
async function getDictionary(time: number): Promise<string[]> {
    // only generate one dictionary per week
    time = Math.floor(time / ONE_WEEK) * ONE_WEEK;

    if (dicts[time] != null) return dicts[time];

    let dict: string[] = [];

    try {
        dict = await level.get(`dictionary:${time}`, { valueEncoding: "json" });
    } catch (err) {
        if (err.notFound) {
            dict = Object.entries(await levelUtils.getMembers<number>("dictionary-string", { valueEncoding: "json" }))
                .sort((a, b) => b[1] - a[1])
                .map((entry) => entry[0].match(/dictionary-string:(.*)/)![1]);
            // save for 2 weeks instead of 1 so that old pings can be decoded
            await level.put(`dictionary:${time}`, dict, { valueEncoding: "json", ttl: ONE_WEEK_MS * 2 });
        } else throw err;
    }

    return dict;
}

export const updateDictionary = async (ctx: Koa.Context): Promise<void> => {
    const { time: timeStr } = ctx.params;
    const time = Math.floor(parseInt(timeStr) / ONE_WEEK) * ONE_WEEK;

    const dict = await getDictionary(time);

    ctx.body = dict;
};

type WorldUpdateCacherEvents = {
    update: (ping: api.DynmapPing) => void;
};

class WorldUpdateCacher extends (EventEmitter as new () => TypedEmitter<WorldUpdateCacherEvents>) {
    worldName: string;

    constructor(worldName: string) {
        super();

        this.worldName = worldName;
        this.loop();
    }

    async loop() {
        let last = 0;

        setInterval(async () => {
            let lateby = 1000;
            try {
                //TODO: Bring back timeout
                const res = (await (
                    await fetch(`${process.env.DYNMAP_BACKEND!}up/world/${this.worldName}/1`, {})
                ).json()) as api.DynmapPing;

                if (res.timestamp === last) return;
                last = res.timestamp;

                this.processUpdates(res.updates);
                this.emit("update", res);
            } catch (err) {
                // silent fail
            }
        }, 500);
    }

    processUpdates(updates: api.DynmapUpdate[]) {
        for (const update of updates) {
            if (update.type != "tile") continue;
            const tileCoords = update.name.match(/.*\/.*\/(.*)\..*/)?.[1];
            const mapID = update.name.match(/([^\/]*)\/*/)?.[1];
            const cacheId = `tile:${this.worldName}:${mapID}:${tileCoords}`;
            tileCache.delete(cacheId);
        }
    }
}

async function configureWorldUpdateCachers() {
    try {
        //TODO: bring back timeout
        const res = (await (await fetch(`${process.env.DYNMAP_BACKEND!}up/configuration`, {})).json()) as any;

        for (const world of res.worlds) {
            world.name;
            worldUpdateCachers.set(world.name, new WorldUpdateCacher(world.name));
        }

        tileCache.clear();
    } catch (err) {
        await sleep(1000);
        configureWorldUpdateCachers();
    }
}

configureWorldUpdateCachers();
