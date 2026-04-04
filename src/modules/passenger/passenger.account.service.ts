import { createHash, randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { logger } from "../../config/logger";
import { db } from "../../database/db";
import { emailChangeRequests, users } from "../../database/schema";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from "../../errors/app-error";
import { comparePassword, hashPassword } from "../../library/bcrypt";
import { sendEmailChangeVerificationEmail } from "../../library/email";
import { usersFindUserForAuth, usersFindUserProfileById } from "../users/users.service";

interface PassengerAccountUserRow {
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  passwordHash: string;
  profileUrl: string | null;
}

interface EmailChangeRequestRow {
  codeHash: string;
  expiresAt: Date;
  pendingEmail: string;
  userId: string;
}

const EMAIL_CHANGE_EXPIRY_MINUTES = 10;

function buildVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashVerificationCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function buildEmailChangeExpiryDate() {
  return new Date(Date.now() + EMAIL_CHANGE_EXPIRY_MINUTES * 60 * 1000);
}

async function getPassengerAccountUser(userId: string): Promise<PassengerAccountUserRow> {
  const [user] = await db
    .select({
      email: users.email,
      firstName: users.firstName,
      id: users.id,
      lastName: users.lastName,
      passwordHash: users.passwordHash,
      profileUrl: users.profileUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
}

async function getPendingEmailChangeRequest(userId: string): Promise<EmailChangeRequestRow | null> {
  const [requestRow] = await db
    .select({
      codeHash: emailChangeRequests.codeHash,
      expiresAt: emailChangeRequests.expiresAt,
      pendingEmail: emailChangeRequests.pendingEmail,
      userId: emailChangeRequests.userId,
    })
    .from(emailChangeRequests)
    .where(eq(emailChangeRequests.userId, userId))
    .limit(1);

  return requestRow ?? null;
}

async function assertEmailAvailableForPassenger(
  nextEmail: string,
  currentUserId: string,
) {
  const existingUser = await usersFindUserForAuth(nextEmail);

  if (existingUser && existingUser.id !== currentUserId) {
    throw new ConflictError("Email is already registered");
  }

  const [existingPendingRequest] = await db
    .select({
      userId: emailChangeRequests.userId,
    })
    .from(emailChangeRequests)
    .where(eq(emailChangeRequests.pendingEmail, nextEmail))
    .limit(1);

  if (existingPendingRequest && existingPendingRequest.userId !== currentUserId) {
    throw new ConflictError("Email is already reserved for another verification request");
  }
}

export async function passengerRequestEmailChange(
  userId: string,
  input: {
    newEmail: string;
  },
) {
  const user = await getPassengerAccountUser(userId);
  const nextEmail = input.newEmail.trim().toLowerCase();

  if (nextEmail === user.email.toLowerCase()) {
    throw new BadRequestError("Enter a different email address");
  }

  await assertEmailAvailableForPassenger(nextEmail, userId);

  const verificationCode = buildVerificationCode();
  const codeHash = hashVerificationCode(verificationCode);
  const expiresAt = buildEmailChangeExpiryDate();

  await db
    .insert(emailChangeRequests)
    .values({
      userId,
      pendingEmail: nextEmail,
      codeHash,
      expiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: emailChangeRequests.userId,
      set: {
        codeHash,
        expiresAt,
        pendingEmail: nextEmail,
        updatedAt: new Date(),
      },
    });

  try {
    await sendEmailChangeVerificationEmail(
      nextEmail,
      user.firstName,
      verificationCode,
    );
  } catch (error) {
    await db.delete(emailChangeRequests).where(eq(emailChangeRequests.userId, userId));

    logger.error({
      msg: "Passenger email verification code could not be delivered",
      error,
      nextEmail,
      userId,
    });

    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    throw new ServiceUnavailableError(
      "Verification email could not be sent. Please try again in a moment.",
    );
  }

  return {
    expiresAt: expiresAt.toISOString(),
    pendingEmail: nextEmail,
  };
}

export async function passengerVerifyEmailChange(
  userId: string,
  input: {
    code: string;
  },
) {
  const requestRow = await getPendingEmailChangeRequest(userId);

  if (!requestRow) {
    throw new NotFoundError("No pending email verification request found");
  }

  if (requestRow.expiresAt.getTime() < Date.now()) {
    await db.delete(emailChangeRequests).where(eq(emailChangeRequests.userId, userId));
    throw new BadRequestError("The verification code has expired. Request a new code.");
  }

  const receivedCodeHash = hashVerificationCode(input.code.trim());

  if (receivedCodeHash !== requestRow.codeHash) {
    throw new BadRequestError("The verification code is invalid");
  }

  await assertEmailAvailableForPassenger(requestRow.pendingEmail, userId);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        email: requestRow.pendingEmail,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await tx.delete(emailChangeRequests).where(eq(emailChangeRequests.userId, userId));
  });

  return usersFindUserProfileById(userId);
}

export async function passengerUpdatePassword(
  userId: string,
  input: {
    currentPassword: string;
    newPassword: string;
  },
) {
  const user = await getPassengerAccountUser(userId);
  const passwordMatches = await comparePassword(
    input.currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new UnauthorizedError("Current password is incorrect");
  }

  const nextPasswordHash = await hashPassword(input.newPassword.trim());

  await db
    .update(users)
    .set({
      passwordHash: nextPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return {
    updated: true,
  };
}

export async function passengerUpdateName(
  userId: string,
  input: {
    currentPassword: string;
    firstName: string;
    lastName: string;
  },
) {
  const user = await getPassengerAccountUser(userId);
  const passwordMatches = await comparePassword(
    input.currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new UnauthorizedError("Password confirmation is incorrect");
  }

  await db
    .update(users)
    .set({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return usersFindUserProfileById(userId);
}

export async function passengerUpdateProfilePhoto(
  userId: string,
  input: {
    profileUrl: string | null;
  },
) {
  const existingUser = await getPassengerAccountUser(userId);
  const nextProfileUrl = typeof input.profileUrl === "string"
    ? input.profileUrl.trim()
    : null;

  if (nextProfileUrl === existingUser.profileUrl) {
    return usersFindUserProfileById(userId);
  }

  await db
    .update(users)
    .set({
      profileUrl: nextProfileUrl,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return usersFindUserProfileById(userId);
}
