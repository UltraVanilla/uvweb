import * as Knex from "knex";
import dotenv from "dotenv";
dotenv.config();

const migrations = {
    tableName: "knex_migrations",
    directory: "./lib/migrations",
    loadExtensions: [".js"],
};

const options = "?supportBigNumbers=true&charset=utf8mb4";

const config: { [env: string]: Knex.Knex.Config } = {
    development: {
        client: "mysql",
        connection: (process.env.MYSQL_URI || "mysql://foo:bar@localhost/ultravanilla") + options,
        pool: {
            min: 0,
            max: 10,
        },
        migrations,
    },

    production: {
        client: "mysql",
        connection: (process.env.MYSQL_URI || "does not exist") + options,
        pool: {
            min: 0,
            max: 10,
        },
        migrations,
    },

    dynmap: {
        client: "mysql",
        connection: (process.env.DYNMAP_MYSQL_URI || "does not exist") + options,
        pool: {
            min: 0,
            max: 10,
        },
    },
};

export default config;
