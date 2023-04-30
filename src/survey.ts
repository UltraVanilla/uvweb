import Koa from "koa";
import CoreProtectUser from "./model/CoreProtectUser";
import SurveySubmission from "./model/SurveySubmission";

import { ultravanillaSession } from "./auth/";

export default [
    ...ultravanillaSession(() => true),
    async (ctx: Koa.Context): Promise<void> => {
        const login = ctx.coreProtectUser;

        const form = ctx.request.body;
        if (form == null) ctx.throw(400, "No form submitted");

        const user = await CoreProtectUser.query().findOne({ user: form.username });
        if (user == null) ctx.throw(400, "That username has never logged into UltraVanilla");
        if (login != null && login.uuid !== user.uuid)
            ctx.throw(400, "Stop trying to submit responses on other people's behalf you weirdo");

        const surveyId = ctx.params.survey.toString();

        // make sure if there is an existing submission, we update it instead of creating a new one
        const surveySubmission =
            (await SurveySubmission.query().findOne({ coreprotect_uid: user.rowid, survey_id: surveyId })) ||
            SurveySubmission.fromJson({});

        if (surveySubmission.id != null && login == null)
            ctx.throw(
                400,
                "Response has already been submitted for this username, login with /token to make changes to it. Once you have done this, refresh this page or click the 'back' button in your web browser to resubmit.",
            );

        const anonymizedFields = Object.entries(form).filter(([field, value]) => field.startsWith("anonymized-"));
        if (anonymizedFields.length > 0) {
            const enderman = await CoreProtectUser.query().findOne({ user: "#enderman" });
            for (const [field, value] of anonymizedFields) {
                if (field.startsWith("anonymized-")) {
                    delete form[field];
                    const anonymizedSubmission = SurveySubmission.fromJson({
                        coreProtectUser: enderman,
                        surveyId: `anonymized-${surveyId}`,
                        responses: { [field]: value },
                        time: new Date(0),
                    });
                    await SurveySubmission.query().upsertGraph(anonymizedSubmission, { relate: true });
                }
            }
        }

        delete form.username;
        surveySubmission.coreProtectUser = user;
        surveySubmission.surveyId = surveyId;
        surveySubmission.responses = form as typeof surveySubmission.responses;
        surveySubmission.time = new Date();

        await SurveySubmission.query().upsertGraph(surveySubmission, { relate: true });

        ctx.body = "Your response has been recorded!";
    },
];
