import { eq } from "drizzle-orm";
import { db } from "../../database/db";
import { passengers, roles, users, vehicleAssignments } from "../../database/schema";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../../errors/app-error";
import { comparePassword, hashPassword } from "../../library/bcrypt";
import { sendWelcomeEmail } from "../../library/email";
import { signAccessToken } from "../../library/jwt";
import { usersFindUserForAuth, usersFindUserProfileById } from "../users/users.service";
import type { AuthResponse } from "./auth.types";

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  contact?: string;
  username?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

function buildAuthResponse(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "driver" | "passenger" | "staff";
  status: string;
}): AuthResponse {
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    user,
  };
}

async function assertDriverHasAssignedVehicle(user: {
  id: string;
  role: "admin" | "driver" | "passenger" | "staff";
}) {
  if (user.role !== "driver") {
    return;
  }

  const [assignmentRow] = await db
    .select({
      vehicleId: vehicleAssignments.vehicleId,
    })
    .from(vehicleAssignments)
    .where(eq(vehicleAssignments.driverUserId, user.id))
    .limit(1);

  if (!assignmentRow?.vehicleId) {
    throw new ForbiddenError("Driver must be assigned to a vehicle before logging in.");
  }
}

export async function authRegisterPassenger(input: RegisterInput): Promise<AuthResponse> {
  const email = input.email.toLowerCase();
  const existingUser = await usersFindUserForAuth(email);

  if (existingUser) {
    throw new ConflictError("Email is already registered");
  }

  const [passengerRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, "passenger")).limit(1);

  if (!passengerRole) {
    throw new ConflictError("Passenger role is not seeded yet");
  }

  const passwordHash = await hashPassword(input.password);

  const createdUser = await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        roleId: passengerRole.id,
        email,
        passwordHash,
        firstName: input.firstName.trim(),
        middleName: input.middleName?.trim() || null,
        lastName: input.lastName.trim(),
        contact: input.contact?.trim() || null,
        status: "active",
      })
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        status: users.status,
      });

    await tx.insert(passengers).values({
      userId: newUser.id,
      username: input.username?.trim() || null,
      status: "active",
    });

    return newUser;
  });

  void sendWelcomeEmail(createdUser.email, createdUser.firstName);

  return buildAuthResponse({
    ...createdUser,
    role: "passenger",
  });
}

export async function authLogin(input: LoginInput): Promise<AuthResponse> {
  const user = await usersFindUserForAuth(input.email);

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordMatches = await comparePassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.status === "inactive") {
    throw new ForbiddenError("This account is inactive");
  }

  if (user.status === "suspended") {
    throw new ForbiddenError("This account is suspended");
  }

  await assertDriverHasAssignedVehicle(user);

  await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));

  return buildAuthResponse({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
  });
}

export async function authGetCurrentUser(userId: string) {
  const user = await usersFindUserProfileById(userId);
  await assertDriverHasAssignedVehicle(user);
  return user;
}
