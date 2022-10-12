import knex from "../knex";
import { Model, snakeCaseMappers } from "objection";

import CoreProtectUser from "./CoreProtectUser";

export default class LoginToken extends Model {
    static columnNameMappers = snakeCaseMappers();
    static tableName = "login_tokens";
    static idColumn = "token";

    id!: number;
    expires!: Date;
    token!: string;
    uuid!: string;

    coreProtectUser!: CoreProtectUser;

    static relationMappings = {
        coreProtectUser: {
            relation: Model.BelongsToOneRelation,
            modelClass: `${__dirname}/CoreProtectUser`,
            join: {
                from: "co_user.uuid",
                to: "login_tokens.uuid",
            },
        },
    };
}

LoginToken.knex(knex);
