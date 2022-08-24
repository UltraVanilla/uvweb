import * as Knex from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("users", (table) => {
        table.dropColumn("id");
    });

    await knex.schema.alterTable("users", (table) => {
        table.string("uuid", 36);
    });

    const results = await knex("users").select(["coreprotect_uid"]);

    for (const result of results) {
        const uuid = await knex("co_user").select("uuid").where("rowid", result.coreprotect_uid);
        await knex("users").update({ uuid: uuid[0].uuid }).where("coreprotect_uid", result.coreprotect_uid);
    }

    await knex.schema.alterTable("users", (table) => {
        table.string("uuid", 36).primary().unique().notNullable().alter();
        table.index("uuid");
    });
}

export async function down(knex: Knex): Promise<void> {}
