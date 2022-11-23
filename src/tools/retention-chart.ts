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
            await fs.promises.readFile(process.argv[3] || "null", { encoding: "utf8" }),
        );

        for (const [uuid, alts] of Object.entries(sameUsers)) {
            for (const alt of alts) {
                canonicalUsers[alt] = uuid;
            }
        }
    } catch (err) {
        // if the file doesn't exist, do without it
        if (err.code !== "ENOENT") throw err;
    }

    let timeline: { start: Date; end: Date | null; event: string; category: string }[] = [];
    try {
        const timelineStr = await fs.promises.readFile(process.argv[4] || "null", { encoding: "utf8" });

        timeline = timelineStr
            .trim()
            .split("\n")
            .filter((str) => !str.startsWith("|-") && str.startsWith("| "))
            .map((str) => {
                const split = str.split("||");
                const end = split[1].trim();
                return {
                    start: new Date(split[0].slice(1).trim()),
                    end: end === "" ? null : new Date(end),
                    category: split[2],
                    event: split[3]
                        .trim()
                        .replaceAll(/\[\[([^\]\|]+)\|([^\]\|]+)\]\]/g, "$2")
                        .replaceAll(/\[\[/g, "")
                        .replaceAll(/\]\]/g, "")
                        .replaceAll("''", ""),
                };
            });
    } catch (err) {
        // if the file doesn't exist, do without it
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
    const gapRight = 330;
    const gapTop = 50;
    const gapBottom = 10;

    const fontSize = 10;
    const nameGap = 20;
    const verticalGap = 10;

    const canvas = createCanvas(
        gapLeft + gapRight + xscale * (lastWeek - firstWeek),
        gapTop + gapBottom + yscale * users.length + fontSize * 2 * timeline.length,
    );
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `normal ${fontSize}px "Noto Sans"`;
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

    const coreprotectUsers = await coreprotectUsersPromise;
    const uuidUsernameMappings: { [uuid: string]: string } = {};
    for (const coreprotectUser of coreprotectUsers) {
        if (coreprotectUser.uuid != null) {
            uuidUsernameMappings[coreprotectUser.uuid] = coreprotectUser.user;
        }
    }

    let playTimes: { [uuid: string]: number } = {};
    let maxPlayTime = 1;
    try {
        const playTimesString = await fs.promises.readFile(process.argv[5] || "null", { encoding: "utf8" });

        for (const line of playTimesString.trim().split("\n").slice(1)) {
            const [rank, username, playTime] = line.split("\t");
            let uuid = Object.keys(uuidUsernameMappings).find((key) => uuidUsernameMappings[key] === username)!;
            if (canonicalUsers[uuid]) uuid = canonicalUsers[uuid];

            const playTimeInt = parseInt(playTime);
            playTimes[uuid] = playTimeInt;
            maxPlayTime = Math.max(maxPlayTime, playTimeInt);
        }
    } catch (err) {
        // if the file doesn't exist, do without it
        if (err.code !== "ENOENT") throw err;
    }

    const textMetrics = ctx.measureText("0");
    const textHeight = verticalGap + textMetrics.actualBoundingBoxAscent + (textMetrics as any).emHeightDescent;

    let shiftedLeft = 0;
    let shiftedTop = gapTop;
    for (const [id, user] of users.entries()) {
        if (id % textHeight === 0) shiftedLeft = 0;
        let first = true;

        const userJoinWeek = Math.min(...user.weeks);
        const username = uuidUsernameMappings[user.uuid];

        let plotColor = "white";
        if (maxPlayTime !== 1) {
            const playTime = playTimes[user.uuid] || 1;
            const playIntensity = playTime / (Math.max(...user.weeks) - userJoinWeek + 1);

            plotColor = `hsl(0,0%,${100 * Math.min(1, playIntensity / 252000)}%)`;
        }

        shiftedTop += yscale;
        for (const week of user.weeks) {
            const xstart = gapLeft + xscale * (week - firstWeek);
            const ystart = shiftedTop;

            if (first && user.weeks.size >= 8) {
                const { width } = ctx.measureText(username);

                ctx.fillStyle = `hsl(${230 + (-230 * user.weeks.size) / (lastWeek - userJoinWeek)},100%,64%)`;

                ctx.fillText(username, xstart - shiftedLeft - width - nameGap, ystart);
                shiftedLeft += width + nameGap;
                first = false;
            }
            if (week >= lastWeek - 3) ctx.fillStyle = "#FF1493";
            else ctx.fillStyle = plotColor;

            ctx.fillRect(xstart, ystart, xscale, yscale);
        }

        const currentTime = getWeekDate(userJoinWeek);
        const timelineEvents = timeline.filter((event) => event.start <= currentTime);

        for (const event of timelineEvents) {
            ctx.fillStyle = "#bf8cf7";

            shiftedTop += fontSize * 2;
            const xstart = gapLeft + xscale * (userJoinWeek - firstWeek);
            const ystart = shiftedTop - fontSize / 2;

            ctx.fillText(event.event, xstart, ystart);
        }

        timeline = timeline.filter((event) => event.start > currentTime);
    }

    const out = fs.createWriteStream("retention.png");
    const stream = canvas.createPNGStream().pipe(out);
    await new Promise((resolve, _reject) => out.once("finish", resolve));

    knex.destroy();
}

function getWeekNumber(date: Date): number {
    return Math.floor(date.getTime() / 604800000);
}

function getWeekDate(weekNum: number): Date {
    return new Date(weekNum * 604800000);
}

run();
