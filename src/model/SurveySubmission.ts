import knex from "../knex";
import { Model, snakeCaseMappers } from "objection";

import { hasDate, hasEmbeddedJson } from "../util/db";
import Survey from "./Survey";
import CoreProtectUser from "./CoreProtectUser";

@hasEmbeddedJson("responses")
export default class SurveySubmission extends Model {
    static columnNameMappers = snakeCaseMappers();
    static tableName = "survey_submissions";
    static idColumn = "id";

    id!: number;
    time!: Date;
    coreprotectUid!: number;
    surveyId!: string;
    responses!: { [questionId: string]: string };

    coreProtectUser!: CoreProtectUser;
    survey!: Survey;

    static relationMappings = {
        coreProtectUser: {
            relation: Model.BelongsToOneRelation,
            modelClass: `${__dirname}/CoreProtectUser`,
            join: {
                from: "co_user.rowid",
                to: "survey_submissions.coreprotect_uid",
            },
        },
        survey: {
            relation: Model.BelongsToOneRelation,
            modelClass: `${__dirname}/Survey`,
            join: {
                from: "surveys.survey_id",
                to: "survey_submissions.survey_id",
            },
        },
    };
}

SurveySubmission.knex(knex);
