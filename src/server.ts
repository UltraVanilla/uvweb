import { format } from "util";

import Koa from "koa";
import proxy from "koa-proxies";
import serve from "koa-static";
import mount from "koa-mount";
import Router from "koa-router";
import bodyParser from "koa-bodyparser";

import winston from "winston";

import { configureSessions } from "./session";
import * as tileServer from "./tiles-server";

const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
    ),
    transports: [new winston.transports.Console()],
});

const app = new Koa();

app.use(async (ctx, next) => {
    try {
        await next();
    } finally {
        const logFormat = '%s - - [%s] "%s %s HTTP" %d %s (%s)\n';

        // eslint-disable-next-line unicorn/explicit-length-check
        const length = ctx.length ? ctx.length.toString() : "-";

        process.stdout.write(
            format(
                logFormat,
                ctx.ip,
                new Date().toISOString(),
                ctx.method,
                ctx.path,
                ctx.status,
                length,
                ctx.headers["user-agent"],
            ),
        );
    }
});

const WELL_KNOWN_STRING = process.env.WELL_KNOWN_DATA;
if (WELL_KNOWN_STRING != null) {
    const WELL_KNOWN_DATA = JSON.parse(WELL_KNOWN_STRING);
    app.use(async (ctx, next) => {
        if (ctx.path.startsWith("/.well-known/")) {
            const path = ctx.path.slice(13);
            const data = WELL_KNOWN_DATA[path];
            if (data == null) return await next();
            ctx.body = data;
        } else {
            await next();
        }
    });
}

const sessionMiddleware = configureSessions(app);

app.use(serve("dynmap", { maxage: 1000 * 60 * 60 * 2 }));
app.use(mount("/assets", serve("assets", { maxage: 1000 * 60 * 60 * 2 })));
app.use(mount("/assets", serve("vendor", { maxage: 1000 * 60 * 60 * 2 })));

// start of our routes middleware

import * as auth from "./auth/";

import pageModifier from "./page-modifier";

import staffRouter from "./staff";

import surveySubmit from "./survey";

const router = new Router();

router.get("/", pageModifier);

router.get("/tiles/:worldID/:mapID/:region/:coords", tileServer.tileServer);
router.get("/up-binary/world/:world/:time", tileServer.worldUpdates);
router.get("/up-dictionary/world/:world/:time", tileServer.updateDictionary);
router.get("/account-info", ...auth.accountInfo);
router.get("/login/:token", ...auth.login);
router.post("/login/:token", bodyParser(), ...auth.login);
router.get("/logout", ...auth.logout);

router.post("/survey-submit/:survey", bodyParser(), ...surveySubmit);

router.use(
    "/staff",
    ...auth.ultravanillaSession(auth.isStaff, "Only staff may access this page, run /token to login"),
    staffRouter.routes(),
    staffRouter.allowedMethods(),
);

router.post("/log", bodyParser(), async (ctx) => {
    const contents = ctx.request.body;
    logger.log("info", `telemetry: ${JSON.stringify(contents)}`);
    ctx.body = { success: true };
});

app.use(router.routes());
app.use(router.allowedMethods());

// end of our routes middleware

app.use(
    proxy("/", {
        target: process.env.DYNMAP_BACKEND || "http://199.127.63.229:8123/",
        changeOrigin: true,
    }),
);

import { dbReady } from "./knex";
import { version as levelSchemaVersion } from "./leveldb";

Promise.all([dbReady, levelSchemaVersion])
    .catch((err) => {
        console.error(err);
        logger.log("warn", "Database does not exist or could not migrate!");
    })
    .then(() => {
        const instance = parseInt(process.env.NODE_APP_INSTANCE || "0");
        const port = instance + parseInt(process.env.PORT || "8080");
        const server = app.listen(port);
        app.proxy = true;
        server.keepAliveTimeout = 90 * 1000;
        logger.log("info", `Instance ID: ${instance}`);
        logger.log("info", `App has started on port ${port}`);
    });
