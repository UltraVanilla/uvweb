import knex from "../knex";
import { Model, snakeCaseMappers, ModelOptions } from "objection";

import { hasDate, hasEmbeddedJson } from "../util/db";
import CoreProtectUser from "./CoreProtectUser";
import * as authApi from "../auth/auth-api";
import * as auth from "../auth";

@hasDate("time")
@hasEmbeddedJson("roles")
export default class User extends Model {
    static columnNameMappers = snakeCaseMappers();
    static tableName = "users";
    static idColumn = "id";

    id!: number;
    uuid!: string;
    time!: Date;
    roles!: string[];

    coreProtectUser!: CoreProtectUser;

    permissions!: authApi.UserPermissions;

    static relationMappings = {
        coreProtectUser: {
            relation: Model.BelongsToOneRelation,
            modelClass: `${__dirname}/CoreProtectUser`,
            join: {
                from: "co_user.uuid",
                to: "users.uuid",
            },
        },
    };

    async populatePermissions(coreProtectUser?: CoreProtectUser): Promise<authApi.UserPermissions> {
        if (coreProtectUser != null) this.coreProtectUser = coreProtectUser;
        if (this.coreProtectUser == null) this.coreProtectUser = await this.$relatedQuery("coreProtectUser");
        this.permissions = await auth.getUserPermissions(this.coreProtectUser.uuid);
        return this.permissions;
    }
}

User.knex(knex);
