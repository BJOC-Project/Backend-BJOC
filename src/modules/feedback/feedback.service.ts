import { and, desc, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "../../database/db";
import { appFeedback } from "../../database/schema";
import { buildRelativeWindow } from "../reports/reports.utils";

export async function feedbackGetAppRatings(filter?: string) {
  const range = buildRelativeWindow(filter);
  const rows = await db
    .select({
      rating: appFeedback.rating,
    })
    .from(appFeedback)
    .where(
      and(
        isNotNull(appFeedback.rating),
        gte(appFeedback.createdAt, range.startAt),
        lte(appFeedback.createdAt, range.endAt),
      ),
    );

  const ratings = rows
    .map((row) => row.rating)
    .filter((rating): rating is number => typeof rating === "number");

  const total = ratings.length;
  const average = total > 0
    ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / total).toFixed(1))
    : 0;

  return {
    average,
    total,
  };
}

export async function feedbackGetSuggestions(filter?: string) {
  const range = buildRelativeWindow(filter);
  const rows = await db
    .select({
      category: appFeedback.category,
      created_at: appFeedback.createdAt,
      id: appFeedback.id,
      message: appFeedback.message,
      rating: appFeedback.rating,
    })
    .from(appFeedback)
    .where(
      and(
        isNotNull(appFeedback.message),
        gte(appFeedback.createdAt, range.startAt),
        lte(appFeedback.createdAt, range.endAt),
      ),
    )
    .orderBy(desc(appFeedback.createdAt))
    .limit(10);

  return rows.filter((row) => !!row.message?.trim());
}

export async function feedbackSubmitRating(input: {
  userId: string;
  rating: number;
  message?: string;
  category?: string;
}): Promise<void> {
  await db.insert(appFeedback).values({
    userId: input.userId,
    rating: input.rating,
    message: input.message ?? null,
    category: input.category ?? null,
  });
}
