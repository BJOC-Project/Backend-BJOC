import type { AppRole } from "../../database/schema";

export interface AdminUserListQuery {
  page?: string;
  limit?: string;
  search?: string;
  role?: AppRole;
  status?: string;
}
