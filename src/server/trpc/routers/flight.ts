import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAirport, searchAirports, type Airport } from "@/lib/airports";
import { fromZonedLocal } from "@/lib/datetime";
import { bestTimes, normalizeFlightNumber, resolveArrival } from "@/lib/flight";
import { distanceKm } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import type { Flight } from "@/generated/prisma/client";
import { router, spaceProcedure } from "../init";
import { translator } from "@/i18n/server";

// 비행(PRD §3.3.1). 입력은 사람이 탑승권에서 보는 그대로 - 편명, 출발 현지
// 날짜, 공항 코드, 각 공항 현지 시각 - 을 받고, 서버가 공항 시간대로 UTC 순간을
// 만든다. 도착 날짜는 받지 않고 추론한다(src/lib/flight.ts resolveArrival).

const flightInput = z.object({
  traveler: z.enum(["me", "partner"]),
  flightNumber: z.string().min(3).max(10),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromIata: z.string().length(3),
  toIata: z.string().length(3),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/),
  source: z.enum(["manual", "barcode"]).default("manual"),
});

function bad(
  t: ReturnType<typeof translator>,
  key: Parameters<ReturnType<typeof translator>>[0],
): never {
  const message = t(key);
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

type Ctx = { space: { id: string }; session: { user: { id: string } }; locale?: string };

async function resolveInput(ctx: Ctx, input: z.infer<typeof flightInput>) {
  const t = translator(ctx.locale);
  const flightNumber = normalizeFlightNumber(input.flightNumber);
  if (!flightNumber) bad(t, "errors.flightNumber");
  const from = getAirport(input.fromIata);
  const to = getAirport(input.toIata);
  if (!from || !to) bad(t, "errors.airportNotFound");
  if (from.iata === to.iata) bad(t, "errors.sameAirport");

  let travelerId = ctx.session.user.id;
  if (input.traveler === "partner") {
    const partner = await prisma.user.findFirst({
      where: { spaceId: ctx.space.id, id: { not: ctx.session.user.id } },
      select: { id: true },
    });
    if (!partner) bad(t, "errors.noPartner");
    travelerId = partner.id;
  }

  const scheduledDepartureAt = fromZonedLocal(
    `${input.departureDate}T${input.departureTime}`,
    from.timeZone,
  );
  const scheduledArrivalAt = resolveArrival(
    scheduledDepartureAt,
    input.departureDate,
    input.arrivalTime,
    to.timeZone,
  );
  if (!scheduledArrivalAt) bad(t, "errors.arrivalTime");

  return {
    travelerId,
    flightNumber,
    departureDate: new Date(`${input.departureDate}T00:00:00Z`),
    fromIata: from.iata,
    toIata: to.iata,
    scheduledDepartureAt,
    scheduledArrivalAt,
    source: input.source,
  };
}

const airportView = (a: Airport) => ({
  iata: a.iata,
  city: a.city,
  name: a.name,
  lat: a.lat,
  lng: a.lng,
  timeZone: a.timeZone,
});

/** 화면용 - 공항 정보와 거리를 붙인다(공항 데이터는 서버에만 있다). */
export function serializeFlight(f: Flight, locale?: string) {
  const from = getAirport(f.fromIata, locale);
  const to = getAirport(f.toIata, locale);
  if (!from || !to) return null;
  return {
    id: f.id,
    travelerId: f.travelerId,
    flightNumber: f.flightNumber,
    departureDate: f.departureDate,
    scheduledDepartureAt: f.scheduledDepartureAt,
    scheduledArrivalAt: f.scheduledArrivalAt,
    actualDepartureAt: f.actualDepartureAt,
    actualArrivalAt: f.actualArrivalAt,
    status: f.status,
    from: airportView(from),
    to: airportView(to),
    distanceKm: Math.round(distanceKm(from, to)),
  };
}

export type FlightView = NonNullable<ReturnType<typeof serializeFlight>>;

export const flightRouter = router({
  searchAirports: spaceProcedure
    .input(z.object({ q: z.string().max(40) }))
    .query(({ ctx, input }) => searchAirports(input.q, 8, ctx.locale).map(airportView)),

  list: spaceProcedure.query(async ({ ctx }) => {
    const rows = await prisma.flight.findMany({
      where: { spaceId: ctx.space.id },
      orderBy: { scheduledDepartureAt: "asc" },
    });
    return rows
      .map((f) => serializeFlight(f, ctx.locale))
      .filter((f): f is FlightView => f !== null);
  }),

  create: spaceProcedure.input(flightInput).mutation(async ({ ctx, input }) => {
    const data = await resolveInput(ctx, input);
    const created = await prisma.flight.create({ data: { spaceId: ctx.space.id, ...data } });
    return serializeFlight(created, ctx.locale)!;
  }),

  update: spaceProcedure
    .input(flightInput.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.flight.findFirst({
        where: { id: input.id, spaceId: ctx.space.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const data = await resolveInput(ctx, input);
      const updated = await prisma.$transaction(async (tx) => {
        const f = await tx.flight.update({ where: { id: existing.id }, data });
        // 착륙 편지는 이 항공편의 도착 시각을 따라 움직인다(아직 안 열린 것만).
        await tx.capsule.updateMany({
          where: { flightId: f.id, deliveredAt: null },
          data: { deliverAt: bestTimes(f).arrivalAt },
        });
        return f;
      });
      return serializeFlight(updated, ctx.locale)!;
    }),

  delete: spaceProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await prisma.flight.deleteMany({ where: { id: input.id, spaceId: ctx.space.id } });
    return { ok: true };
  }),
});
