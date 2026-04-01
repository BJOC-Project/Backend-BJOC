import { Writable } from "node:stream";
import pino from "pino";
import { appEnv } from "./env";

type LogRecord = {
  level?: string;
  msg?: string;
  name?: string;
  time?: number;
  [key: string]: unknown;
};

const logLevel =
  appEnv.NODE_ENV === "test"
    ? "silent"
    : appEnv.NODE_ENV === "production"
      ? "info"
      : "debug";

const reservedLogKeys = new Set(["level", "msg", "name", "time"]);

function pad(
  value: number,
  size = 2,
) {
  return value.toString().padStart(size, "0");
}

function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffsetMinutes / 60);
  const offsetRemainderMinutes = absoluteOffsetMinutes % 60;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)} ${sign}${pad(offsetHours)}${pad(offsetRemainderMinutes)}`;
}

function formatLogValue(value: unknown) {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return JSON.stringify(value, null, 2);
}

function formatLogRecord(record: LogRecord) {
  const serviceName = record.name ?? "backend-bjoc";
  const header = `[${formatTimestamp(record.time ?? Date.now())}] ${record.level ?? "INFO"} (${serviceName}): ${record.msg ?? ""}`;

  const detailLines = Object.entries(record)
    .filter(([
      key,
      value,
    ]) => !reservedLogKeys.has(key) && typeof value !== "undefined")
    .map(([
      key,
      value,
    ]) => `${key}: ${formatLogValue(value)}`);

  return `${header}${detailLines.length ? `\n${detailLines.join("\n")}` : ""}\n`;
}

function createPrettyLogStream() {
  return new Writable({
    write(chunk, _encoding, callback) {
      try {
        const record = JSON.parse(chunk.toString()) as LogRecord;
        process.stdout.write(formatLogRecord(record));
      } catch {
        process.stdout.write(chunk.toString());
      }

      callback();
    },
  });
}

export const logger = pino(
  {
    base: {
      name: "backend-bjoc",
    },
    level: logLevel,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
  },
  appEnv.NODE_ENV === "development" ? createPrettyLogStream() : undefined,
);
