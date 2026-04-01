import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { BadRequestError } from "../errors/app-error";

interface RequestSchema {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schema: RequestSchema) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      if (schema.params) {
        req.params = schema.params.parse(req.params) as Request["params"];
      }

      if (schema.query) {
        const parsedQuery = schema.query.parse(req.query) as Record<string, unknown>;
        Object.defineProperty(req, "query", {
          configurable: true,
          enumerable: true,
          value: parsedQuery,
        });
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new BadRequestError("Validation failed", error.flatten()));
        return;
      }

      next(error);
    }
  };
}
