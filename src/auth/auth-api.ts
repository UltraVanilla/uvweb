export interface AuthToken {
    disallowAuth?: boolean;
    groups: string[];
    uuid: string;
}

export interface BulkAuthToken {
    players: AuthToken[];
}

export interface RedisUrlToken {
    getRedisLink: true;
}

export interface AccountInfo {
    permissions: UserPermissions;
    name: string;
    uuid: string;
}

export interface CancelCoreprotectCommandResult {
    commandExists: boolean;
    command?: string;
    state?: string;
}

export interface WorldPing {
    currentCount: number;
    hasStorm: boolean;
    isThundering: boolean;
    confighash: number;
    servertime: number;
    timestamp: number;
    updates: WorldUpdate[];
    players: WorldPingPlayer[];
}

export interface WorldPingPlayer {
    world: string;
    armor: number;
    name: string;
    x: number;
    y: number;
    z: number;
    sort: number;
    health: number;
    type: string;
    account: string;
}

export interface WorldUpdate {
    type: "tile";
    name: string;
    timestamp: number;
}

export const authTokenSchema = {
    $id: "ultravanilla#authToken",
    type: "object",
    required: ["uuid", "groups"],
    properties: {
        uuid: {
            type: "string",
            //TODO: `format: "uuid"` is no longer supported but may be in the future
        },
        groups: {
            type: "array",
            items: { type: "string" },
        },
        disallowAuth: {
            type: "boolean",
        },
    },
};

export const bulkAuthTokenSchema = {
    $id: "ultravanilla#bulkAuthToken",
    type: "object",
    required: ["players"],
    properties: {
        players: {
            type: "array",
            items: { $ref: "ultravanilla#authToken" },
        },
    },
};

export function isStaff({ permissions, uuid }: { permissions?: UserPermissions; uuid?: string }): boolean {
    if (permissions == null || uuid == null) return false;
    return permissions.permissions.includes("uvweb.staff");
}

export interface UserPermissions {
    primaryGroup: string;
    groups: string[];
    permissions: string[];
}

export const defaultPermissions: UserPermissions = {
    primaryGroup: "default",
    groups: ["default"],
    permissions: [],
};
