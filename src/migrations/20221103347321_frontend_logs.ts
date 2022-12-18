import * as Knex from "knex";

export async function up(knex: Knex.Knex): Promise<void> {
    await knex.schema.createTable("frontend_errors", (table) => {
        table.increments("id").primary().notNullable();
        table.timestamp("time", { precision: 3 }).defaultTo(knex.fn.now(3));
        table.timestamp("created_time", { precision: 3 }).defaultTo(knex.fn.now(3));
        table.integer("elapsed");
        table.integer("type");
        table.text("message");
    });
}

export async function down(knex: Knex.Knex): Promise<void> {}
