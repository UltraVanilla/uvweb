export interface AuthToken {
    disallowAuth?: boolean;
    groups: string[];
    uuid: string;
}

export interface BulkAuthToken {
    players: AuthToken[];
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

export { DynmapPing, DynmapUpdate } from "../codecs/dynmap-update-ping";

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
