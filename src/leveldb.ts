import leveldb from "level";
import abstractLeveldown from "abstract-leveldown";
import ttl from "level-ttl";

const level = ttl(leveldb("./data") as any);

export default level;

export const levelUtils = {
    async deleteMembers(start: string) {
        await level.clear({
            gte: start + ":",
            lte: start + "~",
        });
    },
    getMembers<T>(start: string, options: abstractLeveldown.AbstractIteratorOptions = {}): Promise<Record<string, T>> {
        return new Promise((resolve, reject) => {
            const stream = level.createReadStream({ ...options, gte: start + ":", lte: start + "~" });
            const output: Record<string, T> = {};
            stream.on("data", (record) => {
                output[record.key] = record.value as T;
            });
            stream.once("close", () => resolve(output));
            stream.once("end", () => resolve(output));
            stream.once("error", (err) => reject(err));
        });
    },
};

export const version = (async () => {
    let ver: number;
    try {
        ver = await level.get("schemaVersion", { valueEncoding: "json" });
    } catch (err) {
        if (err.notFound) {
            ver = 0;
        } else throw err;
    }

    if (ver <= 0) {
        await level.put("schemaVersion", 1, { valueEncoding: "json" });
    }

    return ver;
})();
