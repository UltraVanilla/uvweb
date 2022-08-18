import * as Knex from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("activity_channel_messages", (table) => {
        table.increments("id").primary().notNullable();
        table.timestamp("time", { precision: 3 }).notNullable();
        table.string("uuid", 36).notNullable().unique();
        table.bigInteger("message_id").unsigned().notNullable();

        table.index("uuid");
        table.index("message_id");
    });
}

export async function down(knex: Knex): Promise<void> {}
