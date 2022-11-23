import childProcess from "child_process";
import fs from "fs";
import mozjpeg from "mozjpeg";
import stream from "stream";

import DmTile from "../model/DmTile";

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function collectStream(stream: stream.Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        stream.on("error", (err: Error) => reject(err));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
}

// original size: 143079.00

async function tileCompress() {
    const date = Date.now() - 259200000;
    while (true) {
        await DmTile.transaction(async (trx) => {
            const tiles = await DmTile.query()
                .where("Format", 0)
                // .where("LastUpdate", "<", date)
                .limit(96)
                .transacting(trx);

            const jobs: Promise<[DmTile, Buffer]>[] = [];

            for (const tile of tiles) {
                const child = childProcess.execFile(mozjpeg, ["-quality", "90"], {
                    encoding: "buffer" as BufferEncoding,
                });
                child.stdin?.write(tile.image || tile.newImage);
                jobs.push(collectStream(child.stdout!).then((result) => [tile, result]));
            }

            const results = await Promise.all(jobs);

            const queries = [];

            for (const [tile, result] of results) {
                const isJpeg = result.slice(0, 3).equals(JPEG_MAGIC);
                if (!isJpeg) {
                    console.error(result);
                    throw new Error("Not a jpeg!");
                    process.exit(1);
                }
                console.log(
                    JSON.stringify({
                        mapID: tile.mapID,
                        x: tile.x,
                        y: tile.y,
                        zoom: tile.zoom,
                        hashCode: tile.hashCode,
                    }),
                );
                queries.push(
                    tile
                        .$query()
                        .patch({
                            image: null as any,
                            newImage: result,
                            format: 1,
                        })
                        .transacting(trx),
                );
            }

            await Promise.all(queries);
        });
    }
}

tileCompress();
