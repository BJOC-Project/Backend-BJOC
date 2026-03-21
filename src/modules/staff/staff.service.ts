import { usersFindUserProfileById } from "../users/users.service";

export function staffViewProfile(userId: string) {
  return usersFindUserProfileById(userId);
}
