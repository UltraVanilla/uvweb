import { readSigned, readUnsigned, writeSigned, writeUnsigned, readLpString, writeLpString } from "./bintools";

export interface HasCoords {
    x: number;
    y: number;
    z: number;
}

export interface DynmapPing {
    confighash: number;
    currentcount: number;
    servertime: number;
    timestamp: number;
    hasStorm: boolean;
    isThundering: boolean;
    players: DynmapPlayer[];
    updates: DynmapUpdate[];
}

export enum DynmapPingBitfield {
    HasStorm = 0b00000001,
    IsThundering = 0b00000010,
}

export interface DynmapPlayer extends HasCoords {
    account: string;
    name: string;
    world: string;
    type: "player";

    sort: number;
    health: number;
    armor: number;
}

export enum PlayerType {}

export type DynmapUpdate =
    | DynmapUpdateTile
    | DynmapUpdateChat
    | DynmapUpdatePlayerJoin
    | DynmapUpdatePlayerQuit
    | DynmapUpdateDayNight
    | DynmapUpdateComponent;

enum DynmapUpdateType {
    tile,
    chat,
    playerjoin,
    playerquit,
    daynight,
    component,
}

export interface DynmapUpdateBase {
    type: keyof typeof DynmapUpdateType;
    timestamp: number;
}

export interface DynmapUpdateTile extends DynmapUpdateBase {
    type: "tile";
    name: string;
}

export interface DynmapUpdateChat extends DynmapUpdateBase {
    type: "chat";
    account: string;
    channel: string;
    message: string;
    playerName: string;
    source: "player" | "plugin";
}

enum DynmapChatSource {
    player,
    plugin,
}

export interface DynmapUpdatePlayerJoin extends DynmapUpdateBase {
    type: "playerjoin";
    playerName: string;
    account: string;
}

export interface DynmapUpdatePlayerQuit extends DynmapUpdateBase {
    type: "playerquit";
    playerName: string;
    account: string;
}

export interface DynmapUpdateComponent extends DynmapUpdateBase, HasCoords {
    type: "component";
    msg: string;
    id: string;
    label: string;
    icon: string;
    set: string;
    desc: string;
    dim: string;
    minzoom: number;
    maxzoom: number;
    ctype: string;
}

export interface DynmapUpdateDayNight extends DynmapUpdateBase {
    type: "daynight";
    isday: boolean;
}

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const TILE_NAME_REGEX = /^([^\/]+)\/[^\/]+\/(z*)_?(-?\d+)_(-?\d+)\.(\w+)$/;

let buf = new Uint8Array(1024 * 32);

export function extractStrings(update: DynmapPing, knownStrings: string[] = []): string[] {
    const strings: string[] = [];
    for (const upd of update.updates) {
        switch (upd.type) {
            case "playerquit":
            case "playerjoin":
            case "chat":
                if (!strings.includes(upd.playerName) && !knownStrings.includes(upd.playerName))
                    strings.push(upd.playerName);
                if (!strings.includes(upd.account) && !knownStrings.includes(upd.account)) strings.push(upd.account);
                if (upd.type === "chat" && !strings.includes(upd.channel) && !knownStrings.includes(upd.channel))
                    strings.push(upd.channel);
                break;
            case "tile":
                const matches = upd.name.match(TILE_NAME_REGEX);
                // template includes the map name and the file extension
                // like `flat!jpg`
                // it is used to construct strings like `flat/2_1/zzz_88_48.jpg`
                const template = `${matches![1]}!${matches![5]}`;
                if (!strings.includes(template) && !knownStrings.includes(template)) strings.push(template);
                break;
        }
    }
    for (const player of update.players) {
        if (!strings.includes(player.world) && !knownStrings.includes(player.world)) strings.push(player.world);
        if (!strings.includes(player.name) && !knownStrings.includes(player.name)) strings.push(player.name);
        if (!strings.includes(player.account) && !knownStrings.includes(player.account)) strings.push(player.account);
    }
    return strings;
}

export function encode(update: DynmapPing, knownStrings: string[] = []): Uint8Array {
    buf.fill(0, 0, 1024 * 32);
    let offset = 0;

    ({ offset } = writeUnsigned(update.timestamp, buf, offset));
    ({ offset } = writeSigned(update.confighash, buf, offset));
    ({ offset } = writeUnsigned(update.currentcount, buf, offset));
    ({ offset } = writeUnsigned(update.servertime, buf, offset));

    let bitfield = 0;
    if (update.hasStorm) bitfield |= DynmapPingBitfield.HasStorm;
    if (update.isThundering) bitfield |= DynmapPingBitfield.IsThundering;
    buf[offset++] = bitfield;

    const localStrings: string[] = extractStrings(update, knownStrings);
    const strings = [...localStrings, ...knownStrings];

    ({ offset } = writeUnsigned(localStrings.length, buf, offset));
    for (const str of localStrings) {
        ({ offset } = writeLpString(str, buf, offset));
    }

    ({ offset } = writeUnsigned(update.players.length, buf, offset));
    for (const player of update.players) {
        ({ offset } = writeUnsigned(player.sort, buf, offset));
        ({ offset } = writeUnsigned(player.armor, buf, offset));
        ({ offset } = writeUnsigned(player.health, buf, offset));
        ({ offset } = writeUnsigned(strings.indexOf(player.account), buf, offset));
        ({ offset } = writeUnsigned(strings.indexOf(player.name), buf, offset));
        ({ offset } = writeUnsigned(strings.indexOf(player.world), buf, offset));
        ({ offset } = writeSigned(player.x, buf, offset));
        ({ offset } = writeSigned(player.z, buf, offset));
    }

    const updates = update.updates.filter((upd) => !(upd.type === "component" && upd.id.startsWith("_spawn_")));

    ({ offset } = writeUnsigned(updates.length, buf, offset));
    for (const upd of updates) {
        // disable the spawn marker to save space
        if (upd.type === "component" && upd.id.startsWith("_spawn_")) continue;

        // use an offset timestamp to save bytes
        ({ offset } = writeSigned(update.timestamp - upd.timestamp, buf, offset));

        ({ offset } = writeUnsigned(DynmapUpdateType[upd.type], buf, offset));

        switch (upd.type) {
            case "tile":
                const matches = upd.name.match(TILE_NAME_REGEX);
                const template = `${matches![1]}!${matches![5]}`;
                const zoom = matches![2].length;
                const x = parseInt(matches![3]);
                const y = parseInt(matches![4]);

                ({ offset } = writeUnsigned(strings.indexOf(template), buf, offset));

                ({ offset } = writeUnsigned(zoom, buf, offset));
                ({ offset } = writeSigned(x, buf, offset));
                ({ offset } = writeSigned(y, buf, offset));

                break;
            case "chat":
                ({ offset } = writeUnsigned(strings.indexOf(upd.account), buf, offset));
                ({ offset } = writeUnsigned(strings.indexOf(upd.channel), buf, offset));
                ({ offset } = writeUnsigned(strings.indexOf(upd.playerName), buf, offset));
                ({ offset } = writeUnsigned(DynmapChatSource[upd.source], buf, offset));
                ({ offset } = writeLpString(upd.message, buf, offset));
                break;
            case "playerjoin":
            case "playerquit":
                ({ offset } = writeUnsigned(strings.indexOf(upd.account), buf, offset));
                ({ offset } = writeUnsigned(strings.indexOf(upd.playerName), buf, offset));
                break;
            case "daynight":
                ({ offset } = writeUnsigned(+upd.isday, buf, offset));
                break;
            default:
                ({ offset } = writeLpString(JSON.stringify(upd), buf, offset));
                break;
        }
    }

    return buf.slice(0, offset);
}

export function decodeJustTimestamp(buf: Uint8Array): number {
    let offset = 0;

    let timestamp: number;
    ({ offset, num: timestamp } = readUnsigned(buf, offset));

    return timestamp;
}

export function decode(buf: Uint8Array, knownStrings: string[] = []): DynmapPing {
    let offset = 0;

    let timestamp: number;
    ({ offset, num: timestamp } = readUnsigned(buf, offset));

    let confighash: number;
    ({ offset, num: confighash } = readSigned(buf, offset));

    let currentcount: number;
    ({ offset, num: currentcount } = readUnsigned(buf, offset));

    let servertime: number;
    ({ offset, num: servertime } = readUnsigned(buf, offset));

    const bitfield = buf[offset++];
    const isThundering = (bitfield & DynmapPingBitfield.IsThundering) !== 0;
    const hasStorm = (bitfield & DynmapPingBitfield.HasStorm) !== 0;

    let numStrings: number;
    ({ offset, num: numStrings } = readUnsigned(buf, offset));
    let strings: string[] = [];
    for (let i = 0; i < numStrings; i++) {
        let str: string;
        ({ offset, str } = readLpString(buf, offset));
        strings.push(str);
    }
    strings = [...strings, ...knownStrings];

    let numPlayers: number;
    ({ offset, num: numPlayers } = readUnsigned(buf, offset));
    const players: DynmapPlayer[] = [];
    for (let i = 0; i < numPlayers; i++) {
        let sort: number;
        ({ offset, num: sort } = readUnsigned(buf, offset));
        let armor: number;
        ({ offset, num: armor } = readUnsigned(buf, offset));
        let health: number;
        ({ offset, num: health } = readUnsigned(buf, offset));

        let accountId: number;
        ({ offset, num: accountId } = readUnsigned(buf, offset));
        const account = strings[accountId];
        let nameId: number;
        ({ offset, num: nameId } = readUnsigned(buf, offset));
        const name = strings[nameId];
        let worldId: number;
        ({ offset, num: worldId } = readUnsigned(buf, offset));
        const world = strings[worldId];

        let x: number;
        ({ offset, num: x } = readSigned(buf, offset));
        const y = 64;
        let z: number;
        ({ offset, num: z } = readSigned(buf, offset));

        players.push({
            type: "player",
            sort,
            armor,
            health,
            account,
            name,
            world,
            x,
            y,
            z,
        });
    }

    let numUpdates: number;
    ({ offset, num: numUpdates } = readUnsigned(buf, offset));
    const updates: DynmapUpdate[] = [];
    for (let i = 0; i < numUpdates; i++) {
        let updTimestamp: number;
        ({ offset, num: updTimestamp } = readUnsigned(buf, offset));
        // use an offset timestamp to save bytes
        updTimestamp += timestamp;

        let typeId: number;
        ({ offset, num: typeId } = readUnsigned(buf, offset));

        const type = DynmapUpdateType[typeId];

        switch (type) {
            case "tile":
                let templateId: number;
                ({ offset, num: templateId } = readUnsigned(buf, offset));
                let zoom: number;
                ({ offset, num: zoom } = readUnsigned(buf, offset));
                let x: number;
                ({ offset, num: x } = readSigned(buf, offset));
                let y: number;
                ({ offset, num: y } = readSigned(buf, offset));

                const zoomString = zoom === 0 ? "" : "z".repeat(zoom) + "_";
                const name = strings[templateId].replace(
                    "!",
                    `/${Math.floor(x / 32)}_${Math.floor(y / 32)}/${zoomString}${x}_${y}.`,
                );

                updates.push({ type, timestamp: updTimestamp, name });

                break;
            case "chat":
                let accountId: number;
                ({ offset, num: accountId } = readUnsigned(buf, offset));
                let channelId: number;
                ({ offset, num: channelId } = readUnsigned(buf, offset));
                let playerNameId: number;
                ({ offset, num: playerNameId } = readUnsigned(buf, offset));
                let chatSourceId: number;
                ({ offset, num: chatSourceId } = readUnsigned(buf, offset));

                let message: string;
                ({ offset, str: message } = readLpString(buf, offset));

                updates.push({
                    type,
                    timestamp: updTimestamp,
                    account: strings[accountId],
                    channel: strings[channelId],
                    playerName: strings[playerNameId],
                    source: DynmapChatSource[chatSourceId] as keyof typeof DynmapChatSource,
                    message,
                });
                break;
            case "playerjoin":
            case "playerquit":
                let accountId2: number;
                ({ offset, num: accountId2 } = readUnsigned(buf, offset));
                let playerNameId2: number;
                ({ offset, num: playerNameId2 } = readUnsigned(buf, offset));
                updates.push({
                    type,
                    timestamp: updTimestamp,
                    account: strings[accountId2],
                    playerName: strings[playerNameId2],
                });
                break;
            case "daynight":
                let isDay: number;
                ({ offset, num: isDay } = readUnsigned(buf, offset));
                updates.push({
                    type,
                    timestamp: updTimestamp,
                    isday: !!isDay,
                });
                break;
            default:
                let jsonComponent: string;
                ({ offset, str: jsonComponent } = readLpString(buf, offset));
                updates.push(JSON.parse(jsonComponent));
                break;
        }
    }

    return { confighash, currentcount, hasStorm, isThundering, timestamp, servertime, players, updates };
}
