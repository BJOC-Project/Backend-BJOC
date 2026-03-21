import { lookup, resolve6, type LookupAddress, type LookupOptions } from "node:dns";
import { Socket, type LookupFunction, type SocketConnectOpts } from "node:net";
import { URL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { appEnv } from "../config/env";
import { schema } from "./schema";

const databaseUrl = new URL(appEnv.DATABASE_URL);

function isSupabaseHost(hostname: string) {
  return hostname.endsWith(".supabase.co");
}

const lookupWithIpv6Fallback: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, options, (lookupError, address, family) => {
    if (!lookupError) {
      callback(null, address, family);
      return;
    }

    if (!isSupabaseHost(hostname)) {
      callback(lookupError, "", 0);
      return;
    }

    resolve6(hostname, (resolveError, addresses) => {
      if (resolveError || !addresses.length) {
        callback(lookupError, "", 0);
        return;
      }

      if (options.all) {
        callback(
          null,
          addresses.map<LookupAddress>((resolvedAddress) => ({
            address: resolvedAddress,
            family: 6,
          })),
        );
        return;
      }

      callback(null, addresses[0], 6);
    });
  });
};

function createIpv6AwareStream() {
  const socket = new Socket();
  const originalConnect = socket.connect.bind(socket);

  socket.connect = ((
    portOrOptions: number | SocketConnectOpts,
    hostOrListener?: string | (() => void),
    connectionListener?: () => void,
  ) => {
    if (typeof portOrOptions !== "number") {
      return originalConnect(
        portOrOptions,
        typeof hostOrListener === "function" ? hostOrListener : undefined,
      );
    }

    const host = typeof hostOrListener === "string" ? hostOrListener : undefined;
    const listener = typeof hostOrListener === "function" ? hostOrListener : connectionListener;

    if (listener) {
      socket.once("connect", listener);
    }

    return originalConnect({
      port: portOrOptions,
      host,
      lookup: lookupWithIpv6Fallback,
    });
  }) as typeof socket.connect;

  return socket;
}

export const pool = new Pool({
  connectionString: appEnv.DATABASE_URL,
  ssl:
    appEnv.NODE_ENV === "production" || isSupabaseHost(databaseUrl.hostname)
      ? { rejectUnauthorized: false }
      : false,
  connectionTimeoutMillis: 10000,
  stream: isSupabaseHost(databaseUrl.hostname) ? createIpv6AwareStream : undefined,
});

export const db = drizzle(pool, {
  schema,
  logger: appEnv.NODE_ENV === "development",
});
