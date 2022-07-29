import knexfile from "./knexfile";
import Knex from "knex";

const environment = process.env.ENVIRONMENT || "development";

const knex = Knex(knexfile[environment]);
export const dbReady = process.env.NO_MIGRATE === "true" ? Promise.resolve(undefined) : knex.migrate.latest();

export default knex;

export const knexDynmap = Knex(knexfile.dynmap);
