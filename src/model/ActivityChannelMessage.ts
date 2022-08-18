import knex from "../knex";
import { Model, snakeCaseMappers } from "objection";

import { hasDate } from "../util/db";

//@hasDate("time", 1)
export default class ActivityChannelMessage extends Model {
    static columnNameMappers = snakeCaseMappers();
    static tableName = "activity_channel_messages";
    static idColumn = "uuid";

    id!: number;
    time!: Date;
    uuid!: string;
    messageId!: string;
}

ActivityChannelMessage.knex(knex);
