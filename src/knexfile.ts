import Knex from "knex";

const migrations = {
    tableName: "knex_migrations",
    directory: "./lib/migrations",
    loadExtensions: [".js"],
};

if (process.env.MYSQL_URI != null && !process.env.MYSQL_URI.includes("?charset=utf8mb4"))
    process.env.MYSQL_URI = `${process.env.MYSQL_URI}?charset=utf8mb4`;
if (process.env.DYNMAP_MYSQL_URI != null && !process.env.DYNMAP_MYSQL_URI.includes("?charset=utf8mb4"))
    process.env.DYNMAP_MYSQL_URI = `${process.env.DYNMAP_MYSQL_URI}?charset=utf8mb4`;

const config: { [env: string]: Knex.Config } = {
    development: {
        client: "mysql",
        connection: process.env.MYSQL_URI || "mysql://foo:bar@localhost/ultravanilla",
        pool: {
            min: 0,
            max: 5,
        },
        migrations,
    },

    production: {
        client: "mysql",
        connection: process.env.MYSQL_URI || "does not exist",
        pool: {
            min: 0,
            max: 5,
        },
        migrations,
    },

    dynmap: {
        client: "mysql",
        connection: process.env.DYNMAP_MYSQL_URI || "does not exist",
        pool: {
            min: 0,
            max: 5,
        },
    },
};

export default config;
