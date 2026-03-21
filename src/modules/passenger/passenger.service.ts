import { usersFindUserProfileById } from "../users/users.service";

export function passengerViewProfile(userId: string) {
  return usersFindUserProfileById(userId);
}
