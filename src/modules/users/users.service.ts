import { and, asc, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "../../database/db";
import {
  drivers,
  passengers,
  roles,
  staff,
  users,
  type AppRole,
} from "../../database/schema";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../errors/app-error";
import { hashPassword } from "../../library/bcrypt";
import { buildPaginationMeta, resolvePagination } from "../../library/pagination";

const APP_ROLES = [
  "admin",
  "driver",
  "passenger",
  "staff",
] as const;

type UserRecordRow = {
  role: string;
  roleId: string;
};

type UserProfileRow = {
  contact: string | null;
  createdAt: Date;
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  middleName: string | null;
  profileUrl: string | null;
  role: string;
  status: "active" | "inactive" | "suspended";
  suspendedUntil: Date | null;
  suspensionReason: string | null;
  updatedAt: Date;
};

export interface AuthLookupUser {
  contact: string | null;
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  middleName: string | null;
  passwordHash: string;
  profileUrl: string | null;
  role: AppRole;
  status: "active" | "inactive" | "suspended";
  suspendedUntil: Date | null;
  suspensionReason: string | null;
}

export interface UserProfile {
  contact: string | null;
  createdAt: Date;
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  middleName: string | null;
  profileUrl: string | null;
  role: AppRole;
  status: "active" | "inactive" | "suspended";
  suspendedUntil: Date | null;
  suspensionReason: string | null;
  updatedAt: Date;
}

export interface UserListFilters {
  from?: unknown;
  limit?: unknown;
  page?: unknown;
  role?: unknown;
  search?: unknown;
  sort?: unknown;
  status?: unknown;
  to?: unknown;
}

export interface CreateUserInput {
  contact_number?: string;
  email: string;
  first_name: string;
  last_name: string;
  license_number?: string;
  middle_name?: string;
  password: string;
  role: "admin" | "driver" | "operator" | "passenger" | "staff";
}

export interface UpdateUserInput {
  contact_number?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  license_number?: string;
  middle_name?: string;
  password?: string;
  role?: "admin" | "driver" | "operator" | "passenger" | "staff";
}

export interface SuspendUserInput {
  days: number;
  reason: string;
}

function takeFirstString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

function normalizeAppRole(value: string) {
  if (value === "operator") {
    return "staff";
  }

  if (APP_ROLES.includes(value as AppRole)) {
    return value as AppRole;
  }

  return null;
}

function parseDateAtStartOfDay(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000`);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function parseDateAtEndOfDay(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T23:59:59.999`);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function toAppRole(value: string): AppRole {
  const role = normalizeAppRole(value);

  if (!role) {
    throw new NotFoundError("User role is not supported.");
  }

  return role;
}

function mapUserProfile(row: UserProfileRow): UserProfile {
  return {
    contact: row.contact,
    createdAt: row.createdAt,
    email: row.email,
    firstName: row.firstName,
    id: row.id,
    lastName: row.lastName,
    middleName: row.middleName,
    profileUrl: row.profileUrl,
    role: toAppRole(row.role),
    status: row.status,
    suspendedUntil: row.suspendedUntil,
    suspensionReason: row.suspensionReason,
    updatedAt: row.updatedAt,
  };
}

async function getRoleId(roleName: AppRole) {
  const [roleRow] = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(eq(roles.name, roleName))
    .limit(1);

  if (!roleRow) {
    throw new NotFoundError(`${roleName} role is not seeded yet.`);
  }

  return roleRow.id;
}

async function getUserRecord(userId: string): Promise<UserRecordRow> {
  const [userRow] = await db
    .select({
      role: roles.name,
      roleId: users.roleId,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    throw new NotFoundError("User not found");
  }

  return userRow;
}

async function ensureEmailAvailable(
  email: string,
  excludeUserId?: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const [existingUser] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser && existingUser.id !== excludeUserId) {
    throw new ConflictError("Email is already registered");
  }

  return normalizedEmail;
}

async function ensureDriverLicenseAvailable(
  licenseNumber: string,
  excludeUserId?: string,
) {
  const normalizedLicenseNumber = licenseNumber.trim();
  const [existingDriver] = await db
    .select({
      userId: drivers.userId,
    })
    .from(drivers)
    .where(eq(drivers.licenseNumber, normalizedLicenseNumber))
    .limit(1);

  if (existingDriver && existingDriver.userId !== excludeUserId) {
    throw new ConflictError("License number is already registered");
  }

  return normalizedLicenseNumber;
}

export async function usersFindUserForAuth(
  email: string,
): Promise<AuthLookupUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const [userRow] = await db
    .select({
      contact: users.contact,
      email: users.email,
      firstName: users.firstName,
      id: users.id,
      lastName: users.lastName,
      middleName: users.middleName,
      passwordHash: users.passwordHash,
      profileUrl: users.profileUrl,
      role: roles.name,
      status: users.status,
      suspendedUntil: users.suspendedUntil,
      suspensionReason: users.suspensionReason,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!userRow) {
    return null;
  }

  return {
    contact: userRow.contact,
    email: userRow.email,
    firstName: userRow.firstName,
    id: userRow.id,
    lastName: userRow.lastName,
    middleName: userRow.middleName,
    passwordHash: userRow.passwordHash,
    profileUrl: userRow.profileUrl,
    role: toAppRole(userRow.role),
    status: userRow.status,
    suspendedUntil: userRow.suspendedUntil,
    suspensionReason: userRow.suspensionReason,
  };
}

export async function usersFindUserProfileById(
  userId: string,
): Promise<UserProfile> {
  const [userRow] = await db
    .select({
      contact: users.contact,
      createdAt: users.createdAt,
      email: users.email,
      firstName: users.firstName,
      id: users.id,
      lastName: users.lastName,
      middleName: users.middleName,
      profileUrl: users.profileUrl,
      role: roles.name,
      status: users.status,
      suspendedUntil: users.suspendedUntil,
      suspensionReason: users.suspensionReason,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    throw new NotFoundError("User not found");
  }

  return mapUserProfile(userRow);
}

export async function usersListUsers(query: UserListFilters) {
  const pagination = resolvePagination({
    limit: takeFirstString(query.limit),
    page: takeFirstString(query.page),
  });
  const fromDate = parseDateAtStartOfDay(takeFirstString(query.from)?.trim());
  const toDate = parseDateAtEndOfDay(takeFirstString(query.to)?.trim());
  const search = takeFirstString(query.search)?.trim();
  const requestedRole = takeFirstString(query.role)?.trim().toLowerCase();
  const requestedSort = takeFirstString(query.sort)?.trim().toLowerCase();
  const requestedStatus = takeFirstString(query.status)?.trim().toLowerCase();
  const normalizedRole = requestedRole ? normalizeAppRole(requestedRole) : null;
  const normalizedStatus = requestedStatus === "active" || requestedStatus === "inactive" || requestedStatus === "suspended"
    ? requestedStatus
    : null;

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new BadRequestError("The start date cannot be later than the end date.");
  }

  const sortDirection = requestedSort === "asc"
    ? "asc"
    : "desc";
  const filters = [
    search
      ? or(
        ilike(users.firstName, `%${search}%`),
        ilike(users.middleName, `%${search}%`),
        ilike(users.lastName, `%${search}%`),
        ilike(users.email, `%${search}%`),
      )
      : undefined,
    normalizedRole
      ? eq(roles.name, normalizedRole)
      : undefined,
    normalizedStatus
      ? eq(users.status, normalizedStatus)
      : undefined,
    fromDate
      ? gte(users.createdAt, fromDate)
      : undefined,
    toDate
      ? lte(users.createdAt, toDate)
      : undefined,
  ].filter(Boolean);
  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const activeStatusClause = filters.length > 0
    ? and(
      ...filters,
      or(
        eq(users.status, "active"),
        eq(users.status, "inactive"),
      ),
    )
    : or(
      eq(users.status, "active"),
      eq(users.status, "inactive"),
    );
  const suspendedStatusClause = filters.length > 0
    ? and(
      ...filters,
      eq(users.status, "suspended"),
    )
    : eq(users.status, "suspended");
  const [
    items,
    [totalRow],
    [activeRow],
    [suspendedRow],
  ] = await Promise.all([
    db
      .select({
        contact: users.contact,
        createdAt: users.createdAt,
        email: users.email,
        firstName: users.firstName,
        id: users.id,
        lastName: users.lastName,
        middleName: users.middleName,
        profileUrl: users.profileUrl,
        role: roles.name,
        status: users.status,
        suspendedUntil: users.suspendedUntil,
        suspensionReason: users.suspensionReason,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(whereClause)
      .orderBy(sortDirection === "asc" ? asc(users.createdAt) : desc(users.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({
        total: count(users.id),
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(whereClause),
    db
      .select({
        total: count(users.id),
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(activeStatusClause),
    db
      .select({
        total: count(users.id),
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(suspendedStatusClause),
  ]);

  return {
    items: items.map((row) => mapUserProfile(row)),
    meta: {
      ...buildPaginationMeta(Number(totalRow?.total ?? 0), pagination),
      activeCount: Number(activeRow?.total ?? 0),
      suspendedCount: Number(suspendedRow?.total ?? 0),
      sort: sortDirection,
    },
  };
}

export async function usersCreateUser(
  input: CreateUserInput,
) {
  const role = normalizeAppRole(input.role);

  if (!role) {
    throw new BadRequestError("Unsupported user role");
  }

  if (role === "driver" && !input.license_number?.trim()) {
    throw new BadRequestError("License number is required for drivers");
  }

  const normalizedEmail = await ensureEmailAvailable(input.email);
  const normalizedLicenseNumber = role === "driver"
    ? await ensureDriverLicenseAvailable(input.license_number!)
    : null;
  const roleId = await getRoleId(role);
  const passwordHash = await hashPassword(input.password.trim());
  const createdUserId = await db.transaction(async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({
        contact: input.contact_number?.trim() || null,
        email: normalizedEmail,
        firstName: input.first_name.trim(),
        lastName: input.last_name.trim(),
        middleName: input.middle_name?.trim() || null,
        passwordHash,
        roleId,
        status: "active",
      })
      .returning({
        id: users.id,
      });

    if (role === "driver") {
      await tx.insert(drivers).values({
        lastActive: null,
        licenseNumber: normalizedLicenseNumber,
        status: "offline",
        userId: createdUser.id,
      });
    }

    if (role === "passenger") {
      await tx.insert(passengers).values({
        status: "active",
        userId: createdUser.id,
        username: null,
      });
    }

    if (role === "staff") {
      await tx.insert(staff).values({
        department: null,
        position: null,
        userId: createdUser.id,
      });
    }

    return createdUser.id;
  });

  return usersFindUserProfileById(createdUserId);
}

export async function usersUpdateUser(
  userId: string,
  input: UpdateUserInput,
) {
  const targetUser = await getUserRecord(userId);
  const currentRole = toAppRole(targetUser.role);

  if (input.role) {
    const requestedRole = normalizeAppRole(input.role);

    if (!requestedRole) {
      throw new BadRequestError("Unsupported user role");
    }

    if (requestedRole !== currentRole) {
      throw new BadRequestError("Changing user roles is not supported yet");
    }
  }

  if (typeof input.license_number === "string" && currentRole !== "driver") {
    throw new BadRequestError("Only driver accounts can have a license number");
  }

  const userUpdatePayload: Partial<typeof users.$inferInsert> = {};
  const driverUpdatePayload: Partial<typeof drivers.$inferInsert> = {};

  if (typeof input.first_name === "string") {
    userUpdatePayload.firstName = input.first_name.trim();
  }

  if (typeof input.middle_name === "string") {
    userUpdatePayload.middleName = input.middle_name.trim() || null;
  }

  if (typeof input.last_name === "string") {
    userUpdatePayload.lastName = input.last_name.trim();
  }

  if (typeof input.contact_number === "string") {
    userUpdatePayload.contact = input.contact_number.trim() || null;
  }

  if (typeof input.email === "string") {
    userUpdatePayload.email = await ensureEmailAvailable(input.email, userId);
  }

  if (typeof input.password === "string" && input.password.trim()) {
    userUpdatePayload.passwordHash = await hashPassword(input.password.trim());
  }

  if (typeof input.license_number === "string") {
    driverUpdatePayload.licenseNumber = await ensureDriverLicenseAvailable(input.license_number, userId);
  }

  if (Object.keys(userUpdatePayload).length > 0) {
    userUpdatePayload.updatedAt = new Date();
  }

  await db.transaction(async (tx) => {
    if (Object.keys(userUpdatePayload).length > 0) {
      await tx
        .update(users)
        .set(userUpdatePayload)
        .where(eq(users.id, userId));
    }

    if (Object.keys(driverUpdatePayload).length > 0) {
      await tx
        .update(drivers)
        .set(driverUpdatePayload)
        .where(eq(drivers.userId, userId));
    }
  });

  return usersFindUserProfileById(userId);
}

export async function usersDeleteUser(
  userId: string,
  actorUserId?: string,
) {
  if (actorUserId && actorUserId === userId) {
    throw new ForbiddenError("You cannot delete your own account");
  }

  await usersFindUserProfileById(userId);
  await db.delete(users).where(eq(users.id, userId));

  return {
    id: userId,
  };
}

/**
 * Known limitation — token revocation on suspension:
 * Active JWTs held by the suspended user remain valid until they naturally
 * expire (default 7 days). The in-memory blocklist has no per-user token
 * registry, so we cannot enumerate and revoke existing tokens here.
 * Mitigation: suspension is enforced on every *new* login attempt via the
 * status check in authLogin, so the blast radius is bounded to the remaining
 * token lifetime. To close this gap fully, add per-user token tracking
 * (e.g. store jti→userId in Redis) and revoke all matching entries here.
 */
export async function usersSuspendUser(
  userId: string,
  input: SuspendUserInput,
  actorUserId?: string,
) {
  if (actorUserId && actorUserId === userId) {
    throw new ForbiddenError("You cannot suspend your own account");
  }

  const targetUser = await getUserRecord(userId);
  const currentRole = toAppRole(targetUser.role);
  const suspendedUntil = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        status: "suspended",
        suspendedUntil,
        suspensionReason: input.reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    if (currentRole === "driver") {
      await tx
        .update(drivers)
        .set({
          status: "suspended",
        })
        .where(eq(drivers.userId, userId));
    }

    if (currentRole === "passenger") {
      await tx
        .update(passengers)
        .set({
          status: "suspended",
        })
        .where(eq(passengers.userId, userId));
    }
  });

  return usersFindUserProfileById(userId);
}

export async function usersUnsuspendUser(
  userId: string,
  actorUserId?: string,
) {
  if (actorUserId && actorUserId === userId) {
    throw new ForbiddenError("You cannot unsuspend your own account");
  }

  const targetUser = await getUserRecord(userId);
  const currentRole = toAppRole(targetUser.role);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        status: "active",
        suspendedUntil: null,
        suspensionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    if (currentRole === "driver") {
      await tx
        .update(drivers)
        .set({
          status: "offline",
        })
        .where(eq(drivers.userId, userId));
    }

    if (currentRole === "passenger") {
      await tx
        .update(passengers)
        .set({
          status: "active",
        })
        .where(eq(passengers.userId, userId));
    }
  });

  return usersFindUserProfileById(userId);
}
