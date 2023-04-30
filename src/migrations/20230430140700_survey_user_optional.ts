import * as Knex from "knex";

export async function up(knex: Knex.Knex): Promise<void> {
    await knex.schema.alterTable("survey_submissions", (table) => {
        table.dropForeign(["coreprotect_uid"], "survey_submissions_coreprotect_uid_foreign");
        table.dropNullable("coreprotect_uid");
        table.dropUnique(["coreprotect_uid", "survey_id"], "survey_submissions_coreprotect_uid_survey_id_unique");
    });
}

export async function down(knex: Knex.Knex): Promise<void> {}
