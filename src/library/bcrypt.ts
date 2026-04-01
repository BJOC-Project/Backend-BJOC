import bcrypt from "bcrypt";
import { appEnv } from "../config/env";

export function hashPassword(value: string) {
  return bcrypt.hash(value, appEnv.BCRYPT_SALT_ROUNDS);
}

export function comparePassword(
  value: string,
  hash: string,
) {
  return bcrypt.compare(value, hash);
}
