import * as Knex from "knex";

export async function up(knex: Knex.Knex): Promise<void> {
    await knex.schema.createTable("login_tokens", (table) => {
        table.increments("id").primary().notNullable();
        table.timestamp("expires", { precision: 3 }).notNullable();
        table.string("token", 36).notNullable().unique();
        table.string("uuid", 36).notNullable();

        table.index("token");
    });

    await knex.schema.table("users", (table) => {
        table.dropColumn("roles");
    });
}

export async function down(knex: Knex.Knex): Promise<void> {}
