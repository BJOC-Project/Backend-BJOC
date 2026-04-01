const REPORTING_TIME_ZONE = "Asia/Manila";

function pad(
  value: number,
  size = 2,
) {
  return value.toString().padStart(size, "0");
}

export function formatDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORTING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parseDateStart(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+08:00`);
}

export function parseDateEnd(dateKey: string) {
  return new Date(`${dateKey}T23:59:59.999+08:00`);
}

export function buildRelativeWindow(filter?: string) {
  const now = new Date();
  const normalizedFilter =
    filter === "week" || filter === "month"
      ? filter
      : "today";

  if (normalizedFilter === "today") {
    const dateKey = formatDateKey(now);

    return {
      endAt: parseDateEnd(dateKey),
      endDateKey: dateKey,
      startAt: parseDateStart(dateKey),
      startDateKey: dateKey,
    };
  }

  if (normalizedFilter === "week") {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);

    const startDateKey = formatDateKey(startDate);
    const endDateKey = formatDateKey(now);

    return {
      endAt: parseDateEnd(endDateKey),
      endDateKey,
      startAt: parseDateStart(startDateKey),
      startDateKey,
    };
  }

  const startDate = new Date(now);
  startDate.setDate(1);

  const startDateKey = formatDateKey(startDate);
  const endDateKey = formatDateKey(now);

  return {
    endAt: parseDateEnd(endDateKey),
    endDateKey,
    startAt: parseDateStart(startDateKey),
    startDateKey,
  };
}

export function buildExplicitWindow(
  startDate?: string,
  endDate?: string,
) {
  const normalizedStartDate = startDate?.trim() || undefined;
  const normalizedEndDate = endDate?.trim() || undefined;

  return {
    endAt: normalizedEndDate
      ? parseDateEnd(normalizedEndDate)
      : undefined,
    endDateKey: normalizedEndDate,
    startAt: normalizedStartDate
      ? parseDateStart(normalizedStartDate)
      : undefined,
    startDateKey: normalizedStartDate,
  };
}

export function formatHourBucket(date: Date) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORTING_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).format(date);

  return `${hour}:00`;
}
