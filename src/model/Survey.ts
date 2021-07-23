import knex from "../knex";
import { Model, snakeCaseMappers } from "objection";

import { hasDate } from "../util/db";

@hasDate("time")
export default class Survey extends Model {
    static columnNameMappers = snakeCaseMappers();
    static tableName = "surveys";
    static idColumn = "id";

    id!: number;
    time!: Date;
    surveyId!: string;
    anonymous!: boolean;
}

Survey.knex(knex);
