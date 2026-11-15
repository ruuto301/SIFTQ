import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import app from "./app";
import { scheduled } from "./backup";
import type { BackupEnv } from "./backup";

// The Worker default export is the Hono app extended with the cron handler so the
// existing fetch entrypoint (and the tests that call app.request) keep working.
export default Object.assign(app, {
  scheduled: (controller: ScheduledController, env: BackupEnv, ctx: ExecutionContext) => scheduled(controller, env, ctx),
});
