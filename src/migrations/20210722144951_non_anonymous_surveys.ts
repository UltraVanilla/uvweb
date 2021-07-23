import * as Knex from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("surveys", (table) => {
        table.increments("id").primary().notNullable();
        table.dateTime("time").defaultTo(knex.fn.now()).notNullable();
        table.string("survey_id", 100).notNullable().unique();
        table.boolean("anonymous").defaultTo(true).notNullable();
    });
}

export async function down(knex: Knex): Promise<void> {}
