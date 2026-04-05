import { describe, expect, it } from "vitest";
import {
  finalizeCancelledTripPassengerLifecycle,
  finalizeCompletedTripPassengerLifecycle,
  reconcileOngoingPassengerLifecycle,
  type PassengerLifecycleBooking,
} from "../../modules/trips/passenger-lifecycle.service";

function buildBooking(
  input: Partial<PassengerLifecycleBooking> & Pick<PassengerLifecycleBooking, "id">,
): PassengerLifecycleBooking {
  return {
    createdAt: input.createdAt ?? new Date("2026-04-05T08:00:00.000Z"),
    dropoffStopOrder: input.dropoffStopOrder ?? null,
    id: input.id,
    pickupStopOrder: input.pickupStopOrder ?? null,
    status: input.status ?? "booked",
  };
}

describe("passenger lifecycle service", () => {
  it("keeps future pickups booked, marks the current stop as waiting, and cancels missed pickups after occupancy sync", () => {
    const resolvedBookings = reconcileOngoingPassengerLifecycle(
      [
        buildBooking({
          createdAt: new Date("2026-04-05T08:00:00.000Z"),
          dropoffStopOrder: 4,
          id: "booking-1",
          pickupStopOrder: 1,
        }),
        buildBooking({
          createdAt: new Date("2026-04-05T08:01:00.000Z"),
          dropoffStopOrder: 5,
          id: "booking-2",
          pickupStopOrder: 1,
        }),
        buildBooking({
          createdAt: new Date("2026-04-05T08:02:00.000Z"),
          dropoffStopOrder: 5,
          id: "booking-3",
          pickupStopOrder: 2,
        }),
        buildBooking({
          createdAt: new Date("2026-04-05T08:03:00.000Z"),
          dropoffStopOrder: 6,
          id: "booking-4",
          pickupStopOrder: 4,
        }),
      ],
      2,
      {
        currentPassengerCount: 1,
      },
    );

    expect(resolvedBookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
    }))).toEqual([
      {
        id: "booking-1",
        status: "onboard",
      },
      {
        id: "booking-2",
        status: "cancelled",
      },
      {
        id: "booking-3",
        status: "waiting",
      },
      {
        id: "booking-4",
        status: "booked",
      },
    ]);
  });

  it("reduces onboard bookings to match the synced passenger count", () => {
    const resolvedBookings = reconcileOngoingPassengerLifecycle(
      [
        buildBooking({
          createdAt: new Date("2026-04-05T08:00:00.000Z"),
          dropoffStopOrder: 5,
          id: "booking-1",
          pickupStopOrder: 1,
          status: "onboard",
        }),
        buildBooking({
          createdAt: new Date("2026-04-05T08:01:00.000Z"),
          dropoffStopOrder: 6,
          id: "booking-2",
          pickupStopOrder: 2,
          status: "onboard",
        }),
        buildBooking({
          createdAt: new Date("2026-04-05T08:02:00.000Z"),
          dropoffStopOrder: 7,
          id: "booking-3",
          pickupStopOrder: 2,
          status: "booked",
        }),
      ],
      2,
      {
        currentPassengerCount: 1,
      },
    );

    expect(resolvedBookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
    }))).toEqual([
      {
        id: "booking-1",
        status: "onboard",
      },
      {
        id: "booking-2",
        status: "waiting",
      },
      {
        id: "booking-3",
        status: "waiting",
      },
    ]);
  });

  it("fills missing completed bookings from the driver-submitted final passenger total", () => {
    const resolvedState = finalizeCompletedTripPassengerLifecycle(
      [
        buildBooking({
          dropoffStopOrder: 3,
          id: "booking-1",
          pickupStopOrder: 1,
          status: "onboard",
        }),
        buildBooking({
          dropoffStopOrder: 4,
          id: "booking-2",
          pickupStopOrder: 2,
          status: "waiting",
        }),
        buildBooking({
          dropoffStopOrder: 5,
          id: "booking-3",
          pickupStopOrder: 3,
          status: "booked",
        }),
      ],
      2,
    );

    expect(resolvedState.completedBookedPassengerCount).toBe(2);
    expect(resolvedState.resolvedPassengerCount).toBe(2);
    expect(resolvedState.resolvedBookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
    }))).toEqual([
      {
        id: "booking-1",
        status: "completed",
      },
      {
        id: "booking-2",
        status: "completed",
      },
      {
        id: "booking-3",
        status: "cancelled",
      },
    ]);
  });

  it("preserves completed bookings and cancels unfinished ones during emergency termination", () => {
    const resolvedState = finalizeCancelledTripPassengerLifecycle(
      [
        buildBooking({
          dropoffStopOrder: 3,
          id: "booking-1",
          pickupStopOrder: 1,
          status: "completed",
        }),
        buildBooking({
          dropoffStopOrder: 5,
          id: "booking-2",
          pickupStopOrder: 2,
          status: "onboard",
        }),
        buildBooking({
          dropoffStopOrder: 6,
          id: "booking-3",
          pickupStopOrder: 4,
          status: "waiting",
        }),
      ],
      2,
    );

    expect(resolvedState.boardedPassengerCount).toBe(2);
    expect(resolvedState.resolvedPassengerCount).toBe(2);
    expect(resolvedState.resolvedBookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
    }))).toEqual([
      {
        id: "booking-1",
        status: "completed",
      },
      {
        id: "booking-2",
        status: "cancelled",
      },
      {
        id: "booking-3",
        status: "cancelled",
      },
    ]);
  });
});
