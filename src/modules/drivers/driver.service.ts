import { usersFindUserProfileById } from "../users/users.service";

export function driverViewProfile(userId: string) {
  return usersFindUserProfileById(userId);
}
