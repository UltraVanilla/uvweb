import * as Knex from "knex";

export async function up(knex: Knex.Knex): Promise<void> {
    await knex.schema.createTable("cloned_messages", (table) => {
        table.increments("id").primary().notNullable();
        table.timestamp("time", { precision: 3 }).defaultTo(knex.fn.now(3));
        table.bigInteger("src_channel_id").unsigned().notNullable();
        table.bigInteger("src_message_id").unsigned().notNullable();
        table.bigInteger("dest_channel_id").unsigned().notNullable();
        table.bigInteger("dest_message_id").unsigned().notNullable();

        table.index("src_message_id");
        table.index("dest_message_id");
    });
}

export async function down(knex: Knex.Knex): Promise<void> {}
