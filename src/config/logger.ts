import pino from "pino";
import { appEnv } from "./env";

const logLevel =
  appEnv.NODE_ENV === "test"
    ? "silent"
    : appEnv.NODE_ENV === "production"
      ? "info"
      : "debug";

export const logger = pino({
  level: logLevel,
});
