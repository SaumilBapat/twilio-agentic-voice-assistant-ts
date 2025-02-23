import { EnvManager, sLog } from "./helpers.js";
import Twilio from "twilio";
import { selectOption } from "./helpers.js";

export async function checkGetTaskrouterSids(env: EnvManager) {
  const allDefined =
    env.vars.FLEX_WORKFLOW_SID &&
    env.vars.FLEX_WORKSPACE_SID &&
    env.vars.FLEX_QUEUE_SID;

  if (allDefined) return sLog.info("flex env vars are defined");

  const someDefined =
    env.vars.FLEX_WORKFLOW_SID ||
    env.vars.FLEX_WORKSPACE_SID ||
    env.vars.FLEX_QUEUE_SID;

  if (someDefined)
    return sLog.warn(
      "some flex env vars are defined, others are not. cannot setup flex automatically",
    );

  try {
    sLog.info("checking taskrouter environment");
    const twlo = Twilio(env.vars.TWILIO_API_KEY, env.vars.TWILIO_API_SECRET, {
      accountSid: env.vars.TWILIO_ACCOUNT_SID,
    });

    const workspaces = await twlo.taskrouter.v1.workspaces.list();
    if (!workspaces.length) {
      sLog.warn(
        `no taskrouter workspaces found. env variables must be manually added`,
      );
      return false;
    }
    if (workspaces.length > 1) {
      sLog.warn(
        `unable to configure flex. env variables must be manually added`,
      );
      return false;
    }

    const [ws] = workspaces;

    const workflows = await twlo.taskrouter.v1
      .workspaces(ws.sid)
      .workflows.list();

    if (!workflows.length) {
      sLog.warn(
        `no taskrouter workflows found. env variables must be manually added`,
      );
      return false;
    }
    if (workflows.length > 1) {
      sLog.warn(
        `unable to configure flex. env variables must be manually added`,
      );
      return false;
    }

    const [wf] = workflows;

    const queues = await twlo.taskrouter.v1
      .workspaces(ws.sid)
      .taskQueues.list();

    if (!queues.length) {
      sLog.warn(
        `no taskrouter queues found. env variables must be manually added`,
      );
      return false;
    }
    if (queues.length > 1) {
      sLog.warn(
        `unable to configure flex. env variables must be manually added`,
      );
      return false;
    }

    const [queue] = queues;

    env.vars.FLEX_WORKFLOW_SID = wf.sid;
    env.vars.FLEX_WORKSPACE_SID = ws.sid;
    env.vars.FLEX_QUEUE_SID = queue.sid;

    await env.save();
  } catch (error) {
    sLog.error("error trying to fetch taskrouter sids. error: ", error);
    return false;
  }
}

export async function setupFlexWorker(env: EnvManager) {}
