import { appEnv } from "../../config/env";

export function healthGetStatus() {
  return {
    status: "ok",
    environment: appEnv.NODE_ENV,
    timestamp: new Date().toISOString(),
  };
}
