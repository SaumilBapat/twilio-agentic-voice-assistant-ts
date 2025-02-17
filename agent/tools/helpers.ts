import { z } from "zod";
import log from "../../lib/logger.js";
import type { FunctionTool, ToolDependencies } from "../types.js";

export function checkErrors(params: any, schema: z.ZodObject<any>) {
  try {
    schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors;
    }
  }
}

export function makeToolFn<T extends z.ZodObject<any>>({
  name,
  description,
  schema,
  fn,
}: {
  name: string;
  description: string;
  schema: T;
  fn: (args: T, deps: ToolDependencies) => any;
}): FunctionTool<T> {
  const _fn = async (args: T, deps: ToolDependencies) => {
    const errors = checkErrors(args, schema);
    if (errors) return { status: "error", errors };

    try {
      const data = await fn(args, deps);
      return { status: "complete", data };
    } catch (error) {
      log.warn("agent", `tool function (${name}) threw error `, {
        error,
        args,
      });

      return { status: "error", errors: [error] };
    }
  };

  return { name, type: "function", description, schema, fn: _fn };
}
