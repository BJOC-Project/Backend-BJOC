import { count, desc, eq, inArray } from "drizzle-orm";
import { logger } from "../../config/logger";
import { db } from "../db";
import { appFeedback, users } from "../schema";

const FEEDBACK_TIME_ZONE = "Asia/Manila";

const DEMO_FEEDBACK = [
  {
    category: "routing",
    dateOffset: -9,
    email: "passenger.one@bjoc.com",
    message: "The route suggestions are clear, but I would love a faster refresh on vehicle ETAs.",
    rating: 4,
  },
  {
    category: "booking",
    dateOffset: -7,
    email: "passenger.two@bjoc.com",
    message: "Booking works smoothly. Please add a clearer confirmation once the jeepney is assigned.",
    rating: 5,
  },
  {
    category: "tracking",
    dateOffset: -5,
    email: "passenger.three@bjoc.com",
    message: "Vehicle tracking helped a lot, but the map marker stayed offline longer than expected.",
    rating: 3,
  },
  {
    category: "ui",
    dateOffset: -4,
    email: "passenger.one@bjoc.com",
    message: "The app looks cleaner now. A dark map option would still be nice for night trips.",
    rating: 4,
  },
  {
    category: "notifications",
    dateOffset: -3,
    email: "passenger.two@bjoc.com",
    message: "Please send a warning when a scheduled trip is cancelled.",
    rating: 4,
  },
  {
    category: "service",
    dateOffset: -2,
    email: "passenger.three@bjoc.com",
    message: "Drivers were polite and the route estimate was accurate.",
    rating: 5,
  },
  {
    category: "operations",
    dateOffset: -1,
    email: "passenger.one@bjoc.com",
    message: "Show standby vehicles in the passenger app when no scheduled trip is nearby.",
    rating: 4,
  },
  {
    category: "maps",
    dateOffset: 0,
    email: "passenger.two@bjoc.com",
    message: "The stop picker is better now. Adding landmark hints beside each stop would help first-time riders.",
    rating: 5,
  },
] as const;

function formatDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FEEDBACK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildTimestamp(dateOffset: number) {
  const date = new Date();
  date.setDate(date.getDate() + dateOffset);
  const dateKey = formatDateKey(date);

  return new Date(`${dateKey}T10:00:00+08:00`);
}

export async function seedAppFeedback() {
  const [existingFeedback] = await db
    .select({
      total: count(),
    })
    .from(appFeedback);

  if ((existingFeedback?.total ?? 0) > 0) {
    logger.info({
      msg: "Skipping app feedback seed because feedback records already exist",
      total: Number(existingFeedback?.total ?? 0),
    });
    return;
  }

  const passengerEmails = DEMO_FEEDBACK.map((entry) => entry.email);
  const passengerRows = await db
    .select({
      email: users.email,
      id: users.id,
    })
    .from(users)
    .where(inArray(users.email, passengerEmails));

  const userIdByEmail = new Map<string, string>();

  for (const passengerRow of passengerRows) {
    userIdByEmail.set(passengerRow.email, passengerRow.id);
  }

  const feedbackRows = DEMO_FEEDBACK.map((entry) => ({
    category: entry.category,
    createdAt: buildTimestamp(entry.dateOffset),
    message: entry.message,
    rating: entry.rating,
    userId: userIdByEmail.get(entry.email) ?? null,
  }));

  await db.insert(appFeedback).values(feedbackRows);

  const latestFeedback = await db
    .select({
      id: appFeedback.id,
    })
    .from(appFeedback)
    .orderBy(desc(appFeedback.createdAt))
    .limit(1);

  logger.info({
    msg: "App feedback seeded",
    count: feedbackRows.length,
    latestFeedbackId: latestFeedback[0]?.id ?? null,
  });
}
