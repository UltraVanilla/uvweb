import knex from "../knex";
import { Model, snakeCaseMappers } from "objection";

export default class ClonedMessage extends Model {
    static columnNameMappers = snakeCaseMappers();
    static tableName = "cloned_messages";
    static idColumn = "id";

    id!: number;
    time!: Date;
    srcChannelId!: string;
    srcMessageId!: string;
    destChannelId!: string;
    destMessageId!: string;
}

ClonedMessage.knex(knex);
