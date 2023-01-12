import Koa from "koa";
import { Middleware } from "koa";

import jwt from "jsonwebtoken";
import cheerio from "cheerio";

import { transaction } from "objection";
import LRUCache from "lru-cache";

import CoreProtectUser from "../model/CoreProtectUser";
import User from "../model/User";
import * as authApi from "./auth-api";
import schemas from "../ajv-schemas";
import { sessionMiddleware } from "../session";
import level, { levelUtils } from "../leveldb";

import knex from "../knex";
import LoginToken from "../model/LoginToken";

export let jwtPublicKey = `
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2/NW5Jc1zyq+wrLaZ2doJUgS4Utx
KIuDP7pYrXQ2Wz4cnTqOGsknAEhLkVAS9zT4Cxcn7X9at2155cObymun0w==
-----END PUBLIC KEY-----
`;
if (process.env.VAULTJWT_KEY != null)
    process.env.VAULTJWT_KEY = jwtPublicKey = process.env.VAULTJWT_KEY.split("\\n").join("\n");

declare module "koa" {
    interface BaseContext {
        coreProtectUser?: CoreProtectUser;
        user?: User;
    }
}

export function ultravanillaSession(
    filter: (input: { permissions?: authApi.UserPermissions; uuid?: string }) => boolean,
    errorString = "Error",
): Middleware[] {
    return [
        sessionMiddleware,
        async (ctx: Koa.Context, next: Koa.Next): Promise<void> => {
            let allowed = false;
            let user;
            if (ctx.session?.uuid == null || (user = await getCachedUser(ctx.session!.uuid)) == null) {
                allowed = filter({});
                ctx.session = null;
            } else {
                ctx.coreProtectUser = user;
                ctx.user = user.userAccount;

                allowed = filter({ permissions: user.userAccount.permissions, uuid: ctx.session!.uuid });
            }

            if (allowed) await next();
            else ctx.throw(403, errorString);
        },
    ];
}

export const accountInfo = [
    ...ultravanillaSession(() => true),
    async (ctx: Koa.Context, _next: Koa.Next): Promise<void> => {
        if (ctx.coreProtectUser != null && ctx.user != null) {
            const out: authApi.AccountInfo = {
                name: ctx.coreProtectUser.user,
                uuid: ctx.coreProtectUser.uuid,
                permissions: ctx.user.permissions,
            };

            ctx.body = out;
        }
    },
];

export const login = [
    sessionMiddleware,
    async (ctx: Koa.Context): Promise<void> => {
        if (ctx.params == null) throw new TypeError();

        const rawToken = ctx.params.token;

        await LoginToken.query().delete().where("expires", "<", new Date());

        const token = await LoginToken.query().findOne({ token: rawToken }).withGraphFetched("coreProtectUser");

        let coreProtectUser: CoreProtectUser | undefined;

        if (token != null) {
            coreProtectUser = token.coreProtectUser;
        } else {
            let token: authApi.AuthToken;
            try {
                token = <authApi.AuthToken>jwt.verify(rawToken, jwtPublicKey, {
                    ignoreExpiration: process.env.NODE_ENV !== "production",
                });
            } catch (err) {
                if (err instanceof jwt.JsonWebTokenError) {
                    ctx.throw(403, "JSON web token is invalid");
                } else if (err instanceof jwt.TokenExpiredError) {
                    ctx.throw(403, "JSON web token has expired, generate a new one");
                } else if (err instanceof jwt.NotBeforeError) {
                    ctx.throw(403, "JSON web token doesn't exist yet");
                } else throw err;
            }

            if (!schemas.validate("authToken", token)) ctx.throw(400, "Malformed token payload");

            coreProtectUser = await CoreProtectUser.query()
                .findOne({ uuid: token.uuid })
                .withGraphFetched("userAccount");
        }
        if (coreProtectUser == null) return ctx.throw(403, "User does not exist");

        await transaction(User, CoreProtectUser, async (User, CoreProtectUser) => {
            // satisfy the type checker
            if (coreProtectUser == null) throw new Error("unreachable");

            if (ctx.method === "GET") {
                const $ = cheerio.load(`
                    <!doctype html>
                    <html>
                        <head>
                            <meta charset="utf8">
                            <title>Login</title>
                        </head>
                        <body>
                            <p>Logging in as: <span id="uuid"/></p>
                            <form method="post">
                                <label for="duration-input">How long to stay logged in for?</label>
                                <select id="duration-input" name="duration">
                                    <option value="86400000">1 day</option>
                                    <option value="604800000">1 week</option>
                                    <option value="2592000000" selected>1 month</option>
                                    <option value="31536000000">1 year</option>
                                    <option value="157680000000">5 years</option>
                                </select>
                                <input type="submit" value="Login"/>
                            </form>
                        </body>
                    </html>
                `);

                $("#uuid").text(coreProtectUser.user);

                ctx.body = $.root().html();
            } else if (ctx.method === "POST") {
                if (ctx.request.body == null) ctx.throw(400);
                let maxSessionAge = 2592000;
                if (ctx.request.body.duration !== null && typeof ctx.request.body.duration === "string") {
                    maxSessionAge = parseInt(ctx.request.body.duration);
                }

                if (coreProtectUser.userAccount == null) {
                    coreProtectUser.userAccount = new User();
                    coreProtectUser.userAccount.uuid = coreProtectUser.uuid;
                    coreProtectUser.userAccount = await User.query().insertAndFetch(coreProtectUser.userAccount);
                }

                userCache.delete(coreProtectUser.uuid);

                ctx.session!.maxAge = maxSessionAge;
                ctx.session!.uuid = coreProtectUser.uuid;

                await ctx.session!.manuallyCommit();

                ctx.redirect("/");
            }
        });
    },
];

export const logout = [
    sessionMiddleware,
    ...ultravanillaSession(() => true),
    async (ctx: Koa.Context): Promise<void> => {
        if (ctx.coreProtectUser != null) {
            const activeSessionsKey = `activeSessions:${ctx.coreProtectUser.uuid}`;

            const sessions = Object.keys(await levelUtils.getMembers(activeSessionsKey));

            await level.batch(
                sessions.map((sessionKey) => ({
                    type: "del",
                    key: "session:" + sessionKey.split(":").slice(-1)[0],
                })),
            );
            await levelUtils.deleteMembers(activeSessionsKey);
        }

        ctx.session = null;
        ctx.redirect("back", "/");
    },
];

const userCache: LRUCache<string, CoreProtectUser> = new LRUCache({
    max: 500,
    ttl: 1000 * 60 * 60,
});

async function getCachedUser(uuid: string): Promise<CoreProtectUser | undefined> {
    const cached = userCache.get(uuid);
    if (cached != null) return cached;
    const user = await CoreProtectUser.query().findOne({ uuid }).withGraphFetched("userAccount");
    if (user == null) return undefined;
    await user.userAccount.populatePermissions();
    userCache.set(uuid, user);
    return user;
}

export async function getUserPermissions(
    uuid: string,
    prefix: string = "uvweb.",
    server: string = "global",
    world: string = "global",
): Promise<authApi.UserPermissions> {
    const allPermissions: Set<string> = new Set();
    const groups: Set<string> = new Set();

    let player;
    try {
        player = await knex("luckperms_players").select("primary_group").where("uuid", uuid);
    } catch (err) {
        if (err.code === "ER_NO_SUCH_TABLE") {
            return authApi.defaultPermissions;
        } else {
            throw err;
        }
    }

    const userPermissions = await knex("luckperms_user_permissions")
        .select("permission", "value")
        .where("uuid", uuid)
        .where("world", world)
        .where("server", server);

    userPermissions.push({ permission: "group.default", value: 1 });

    async function processPerms(perms: typeof userPermissions) {
        for (const permission of perms) {
            if (permission.value !== 1) continue;
            const segments = permission.permission.split(".");
            if (segments[0] !== "group") continue;

            const group = segments[1];

            if (groups.has(group)) continue;
            groups.add(group);

            const groupPermissions = await knex("luckperms_group_permissions")
                .select("permission", "value")
                .where("name", group)
                .where("world", world)
                .where("server", server);

            await processPerms(groupPermissions);
        }

        for (const permission of perms) {
            if (!permission.permission.startsWith("uvweb.")) continue;
            if (permission.value === 1) {
                allPermissions.add(permission.permission);
            } else {
                allPermissions.delete(permission.permission);
            }
        }
    }

    await processPerms(userPermissions);

    return {
        primaryGroup: player[0]?.primary_group == null ? "default" : player[0].primary_group,
        groups: [...groups],
        permissions: [...allPermissions],
    };
}

export { isStaff } from "./auth-api";
