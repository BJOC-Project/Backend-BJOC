import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../../database/db";
import { drivers, passengers, roles, staff, users, type AppRole } from "../../database/schema";
import { NotFoundError } from "../../errors/app-error";
import { buildPaginationMeta, resolvePagination, type PaginationInput } from "../../utils/pagination";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  profileUrl: string | null;
  contact: string | null;
  status: string;
  role: AppRole;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  driver: {
    licenseNumber: string | null;
    status: string | null;
    lastActive: Date | null;
  } | null;
  passenger: {
    username: string | null;
    status: string | null;
  } | null;
  staff: {
    department: string | null;
    position: string | null;
  } | null;
}

export interface UserListFilters extends PaginationInput {
  search?: string;
  role?: AppRole;
  status?: string;
}

export interface AuthLookupUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  status: string;
  role: AppRole;
}

function toAppRole(roleName: string): AppRole {
  if (roleName === "admin" || roleName === "driver" || roleName === "passenger" || roleName === "staff") {
    return roleName;
  }

  throw new NotFoundError(`Unsupported role found in database: ${roleName}`);
}

function mapUserProfile(row: {
  id: string;
  email: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  profileUrl: string | null;
  contact: string | null;
  status: string;
  role: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  driverLicenseNumber: string | null;
  driverStatus: string | null;
  driverLastActive: Date | null;
  passengerUsername: string | null;
  passengerStatus: string | null;
  staffDepartment: string | null;
  staffPosition: string | null;
}): UserProfile {
  const role = toAppRole(row.role);

  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    profileUrl: row.profileUrl,
    contact: row.contact,
    status: row.status,
    role,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    driver: row.driverLicenseNumber || row.driverStatus || row.driverLastActive
      ? {
          licenseNumber: row.driverLicenseNumber,
          status: row.driverStatus,
          lastActive: row.driverLastActive,
        }
      : null,
    passenger: row.passengerUsername || row.passengerStatus
      ? {
          username: row.passengerUsername,
          status: row.passengerStatus,
        }
      : null,
    staff: row.staffDepartment || row.staffPosition
      ? {
          department: row.staffDepartment,
          position: row.staffPosition,
        }
      : null,
  };
}

export async function usersFindUserForAuth(email: string): Promise<AuthLookupUser | null> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      firstName: users.firstName,
      lastName: users.lastName,
      status: users.status,
      role: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    return null;
  }

  return {
    ...user,
    role: toAppRole(user.role),
  };
}

export async function usersFindUserProfileById(userId: string): Promise<UserProfile> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      middleName: users.middleName,
      lastName: users.lastName,
      profileUrl: users.profileUrl,
      contact: users.contact,
      status: users.status,
      role: roles.name,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      driverLicenseNumber: drivers.licenseNumber,
      driverStatus: drivers.status,
      driverLastActive: drivers.lastActive,
      passengerUsername: passengers.username,
      passengerStatus: passengers.status,
      staffDepartment: staff.department,
      staffPosition: staff.position,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(drivers, eq(drivers.userId, users.id))
    .leftJoin(passengers, eq(passengers.userId, users.id))
    .leftJoin(staff, eq(staff.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    throw new NotFoundError("User not found");
  }

  return mapUserProfile(row);
}

export async function usersListUsers(filters: UserListFilters) {
  const pagination = resolvePagination(filters);
  const searchValue = filters.search?.trim();
  const clauses = [];

  if (filters.role) {
    clauses.push(eq(roles.name, filters.role));
  }

  if (filters.status) {
    clauses.push(eq(users.status, filters.status as "active" | "inactive" | "suspended"));
  }

  if (searchValue) {
    clauses.push(
      or(
        ilike(users.email, `%${searchValue}%`),
        ilike(users.firstName, `%${searchValue}%`),
        ilike(users.lastName, `%${searchValue}%`),
      )!,
    );
  }

  const whereClause = clauses.length > 0 ? and(...clauses) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(whereClause);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      middleName: users.middleName,
      lastName: users.lastName,
      profileUrl: users.profileUrl,
      contact: users.contact,
      status: users.status,
      role: roles.name,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      driverLicenseNumber: drivers.licenseNumber,
      driverStatus: drivers.status,
      driverLastActive: drivers.lastActive,
      passengerUsername: passengers.username,
      passengerStatus: passengers.status,
      staffDepartment: staff.department,
      staffPosition: staff.position,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(drivers, eq(drivers.userId, users.id))
    .leftJoin(passengers, eq(passengers.userId, users.id))
    .leftJoin(staff, eq(staff.userId, users.id))
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return {
    items: rows.map(mapUserProfile),
    meta: buildPaginationMeta(totalRow?.total ?? 0, pagination),
  };
}
