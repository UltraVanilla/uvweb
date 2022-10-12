import Koa from "koa";
import session, { stores as Store, Session } from "koa-session";

import level from "./leveldb";

export let sessionMiddleware: Koa.Middleware;

import * as uuid from "uuid";

import * as crypto from "crypto";

class LevelStore implements Store {
    async get(key: string, maxAge: number, data: { rolling: boolean }): Promise<any> {
        try {
            return await level.get(key, { valueEncoding: "json" });
        } catch (err) {
            if (err.notFound) return null;
            throw err;
        }
    }

    async set(
        key: string,
        sess: Partial<Session> & { _expire?: number | undefined; _maxAge?: number | undefined },
        maxAge: number,
        data: { changed: boolean; rolling: boolean },
    ): Promise<any> {
        await level.put(key, sess, { ttl: maxAge, valueEncoding: "json" });
    }

    async destroy(key: string): Promise<any> {
        await level.del(key);
    }
}

export function configureSessions(app: Koa): Koa.Middleware {
    sessionMiddleware = session(
        {
            store: new LevelStore(),
            signed: false,
            autoCommit: false,
            prefix: "session:",
            genid() {
                const buf = Buffer.alloc(32);
                crypto.randomFillSync(buf);
                return "session:" + buf.toString("hex");
            },
            async beforeSave(ctx: Koa.Context, session: session.Session) {
                if (session.uuid != null) {
                    level.put(
                        `activeSessions:${session.uuid}:${session._sessCtx.externalKey.split(":").slice(-1)[0]}`,
                        "true",
                    );
                }
            },
        },
        app,
    );

    return sessionMiddleware;
}
