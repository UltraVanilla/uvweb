import fs from "node:fs/promises";
import path from "node:path";
import childProcess from "node:child_process";

const LOGTIMESTAMP_REGEX = /\[LogTimestamp\] Current server time: ([^ ]+) (.*)\[(.*)\] ([^ ]+)/;

const logsFolder = process.argv[2];
const defaultTimezone = process.argv[3] || "UTC";

async function run() {
    const logFileNames = (await fs.readdir(logsFolder)).sort();

    for (const logFileName of logFileNames.filter((name) => name.endsWith(".gz"))) {
        const result = await execShellCommand("zcat", [path.join(logsFolder, logFileName)]);
        const matches = logFileName.match(/^(2...)-(..)-(..)/);
        process.env.TZ = defaultTimezone;
        const estDate = new Date();
        estDate.setFullYear(parseInt(matches![1]));
        estDate.setMonth(parseInt(matches![2]) - 1);
        estDate.setDate(parseInt(matches![3]));
        estDate.setHours(0);
        estDate.setMinutes(0);
        estDate.setSeconds(0);
        estDate.setMilliseconds(0);

        useLog(result, estDate);
    }

    const latestPath = path.join(logsFolder, "latest.log");
    const latestTime = (await fs.stat(latestPath)).mtime;

    const contents = await fs.readFile(latestPath, { encoding: "utf8" });
    useLog(contents, latestTime);
}

function useLog(log: string, estimatedDate: Date) {
    let curDate = new Date(estimatedDate);
    let lines = log.split("\n");

    // get the first time reference found and use it as the base date
    for (const line of lines) {
        const timesMatch = line.match(LOGTIMESTAMP_REGEX);

        if (timesMatch != null) {
            applyTimeReference(timesMatch);
            break;
        }
    }

    function applyTimeReference(matches: RegExpMatchArray) {
        const localTimezone = matches[3];
        process.env.TZ = localTimezone;
        curDate = new Date(matches[2]);
    }

    for (const line of lines) {
        const timesMatch = line.match(LOGTIMESTAMP_REGEX);
        if (timesMatch != null) applyTimeReference(timesMatch);

        const matches = line.match(/^\[(..):(..):(..)\]/);

        if (matches != null) {
            curDate.setHours(parseInt(matches![1]));
            curDate.setMinutes(parseInt(matches![2]));
            curDate.setSeconds(parseInt(matches![3]));
        }
        console.log(curDate.toISOString() + " " + line);
    }
}

run();

function execShellCommand(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        childProcess.execFile(
            cmd,
            args,
            {
                encoding: "utf8",
                maxBuffer: Infinity,
            },
            (error, stdout, stderr) => {
                if (error) reject(error);
                else if (stderr.length !== 0) reject(stderr);
                else resolve(stdout ? stdout : stderr);
            },
        );
    });
}
