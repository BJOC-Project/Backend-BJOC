import { describe, expect, it } from "vitest";
import { formatHourBucket } from "../../modules/reports/reports.utils";

describe("reports utils", () => {
  it("formats hour buckets in Asia/Manila time", () => {
    const utcDate = new Date("2026-03-31T18:35:00.000Z");

    expect(formatHourBucket(utcDate)).toBe("02:00");
  });
});
