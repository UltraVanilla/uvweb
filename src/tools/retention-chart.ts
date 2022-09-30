import { createCanvas } from "canvas";
import fs from "node:fs";
import CoreProtectUser from "../model/CoreProtectUser";

import readline from "readline";
import knex from "../knex";

process.env.TZ = "UTC";

async function run() {
    const coreprotectUsersPromise = CoreProtectUser.query();
    const canonicalUsers: { [uuid: string]: string } = {};
    try {
        const sameUsers: { [uuid: string]: string[] } = JSON.parse(
            await fs.promises.readFile(process.argv[3], { encoding: "utf8" }),
        );

        for (const [uuid, alts] of Object.entries(sameUsers)) {
            for (const alt of alts) {
                canonicalUsers[alt] = uuid;
            }
        }
    } catch (err) {
        if (err.code !== "ENOENT") throw err;
    }

    const fileStream = fs.createReadStream(process.argv[2]);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    let firstDate = new Date(Number.MAX_SAFE_INTEGER / 2);
    let lastDate = new Date(Number.MIN_SAFE_INTEGER / 2);

    let users: { uuid: string; weeks: Set<number> }[] = [];
    for await (const line of rl) {
        const matches = line.match(/([^ ]+) .*UUID of player .* is (........-....-....-....-............)/);
        if (matches == null) continue;
        const time = new Date(matches[1]);
        let uuid = matches[2];
        if (canonicalUsers[uuid] != null) uuid = canonicalUsers[uuid];

        const week = getWeekNumber(time);

        if (time < firstDate) firstDate = time;
        if (time > lastDate) lastDate = time;

        let user = users.find((user) => user.uuid == uuid);
        if (user == null) {
            user = { uuid, weeks: new Set() };
            users.push(user);
        }

        user.weeks.add(week);
    }

    const firstWeek = getWeekNumber(firstDate);
    const lastWeek = getWeekNumber(lastDate);

    const xscale = 7;
    const yscale = 1;

    const gapLeft = 500;
    const gapRight = 20;
    const gapTop = 50;
    const gapBottom = 10;

    const fontSize = 10;
    const nameGap = 20;
    const verticalGap = 10;

    const canvas = createCanvas(
        gapLeft + gapRight + xscale * (lastWeek - firstWeek),
        gapTop + gapBottom + yscale * users.length,
    );
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `normal ${fontSize}px JuliaMono`;
    for (let year = firstDate.getUTCFullYear(); year <= lastDate.getUTCFullYear(); year++) {
        for (let month = 0; month < 12; month++) {
            const date = new Date(year, month, 1);
            if (date > lastDate || date.getTime() < firstDate.getTime() - 2629800000) continue;
            const monthName = date.toLocaleString("en-US", { month: "short" });
            const x = gapLeft + xscale * (getWeekNumber(date) - firstWeek);

            ctx.fillStyle = "#f0f0f0";
            ctx.fillText(`${monthName}`, x, 2 * fontSize);

            if (month === 0) {
                ctx.fillText(`${year}`, x, fontSize);
                ctx.lineWidth = 2;
                ctx.strokeStyle = "#3f3f3f";
            } else {
                ctx.strokeStyle = "#2f2f2f";
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    }

    ctx.font = `normal ${fontSize}px JuliaMono`;

    const coreprotectUsers = await coreprotectUsersPromise;
    const uuidUsernameMappings: { [uuid: string]: string } = {};
    for (const coreprotectUser of coreprotectUsers) {
        if (coreprotectUser.uuid != null) {
            uuidUsernameMappings[coreprotectUser.uuid] = coreprotectUser.user;
        }
    }

    const textMetrics = ctx.measureText("0");
    const textHeight = verticalGap + textMetrics.actualBoundingBoxAscent + (textMetrics as any).emHeightDescent;

    let shiftedLeft = 0;
    for (const [id, user] of users.entries()) {
        if (id % textHeight === 0) shiftedLeft = 0;
        let first = true;
        for (const week of user.weeks) {
            const xstart = gapLeft + xscale * (week - firstWeek);
            const ystart = gapTop + yscale * id;

            if (first && user.weeks.size > 8) {
                const username = uuidUsernameMappings[user.uuid];
                const { width } = ctx.measureText(username);

                ctx.fillStyle = `hsl(${
                    230 + (-230 * user.weeks.size) / (lastWeek - Math.min(...user.weeks))
                },100%,64%)`;

                ctx.fillText(username, xstart - shiftedLeft - width - nameGap, ystart);
                shiftedLeft += width + nameGap;
                first = false;
                ctx.fillStyle = "white";
            }
            ctx.fillRect(xstart, ystart, xscale, yscale);
        }
    }

    const out = fs.createWriteStream("retention.png");
    const stream = canvas.createPNGStream().pipe(out);
    await new Promise((resolve, _reject) => out.once("finish", resolve));

    knex.destroy();
}

function getWeekNumber(date: Date): number {
    return Math.floor(date.getTime() / 604800000);
}

run();
