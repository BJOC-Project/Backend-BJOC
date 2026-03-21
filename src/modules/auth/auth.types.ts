import type { AppRole } from "../../database/schema";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: AppRole;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: AppRole;
    status: string;
  };
}
