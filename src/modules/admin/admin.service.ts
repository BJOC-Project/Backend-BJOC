import type { AdminUserListQuery } from "./admin.types";
import { usersFindUserProfileById, usersListUsers } from "../users/users.service";

export function adminListUsers(query: AdminUserListQuery) {
  return usersListUsers(query);
}

export function adminViewProfile(userId: string) {
  return usersFindUserProfileById(userId);
}
