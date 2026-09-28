"use client";

import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Plane, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DateField, TimeField, localTodayValue } from "@/components/ui/date-field";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { type Formatters } from "@/i18n/format";
import { useFormat } from "@/i18n/use-format";
import { partsIn, todayIn, toZonedLocal } from "@/lib/datetime";
import { bestTimes, flightPhase } from "@/lib/flight";
import { useNow } from "@/lib/use-now";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { useTRPC } from "@/trpc/client";
import { BoardingPassScan } from "./boarding-pass-scan";
import { EmptyRow, LoadingRow, Row, Section } from "./memories/section";
import { useMyTimeZone, usePartnerName, useSpace } from "./space-context";

export type FlightView = inferRouterOutputs<AppRouter>["flight"]["list"][number];
type AirportView = FlightView["from"];

/** 항공편 목록 - 기억 탭·우리 장면·위치 시트가 같은 쿼리를 쓴다. */
export function useFlights() {
  const trpc = useTRPC();
  const { summary } = useSpace();
  return useQuery({ ...trpc.flight.list.queryOptions(), initialData: summary.flights });
}

/** "지우" 또는 "나" / "Jiwoo" or "Me" */
export function useTravelerName() {
  const { currentUserId } = useSpace();
  const tc = useTranslations("common");
  const partnerName = usePartnerName();
  return (travelerId: string) => (travelerId === currentUserId ? tc("me") : partnerName);
}

/** "10월 14일 (수) 오전 10:30" - 출발 공항 현지 시각(탑승권에 적힌 그대로). */
export function formatDeparture(fmt: Formatters, f: FlightView) {
  return fmt.dateTime(new Date(f.scheduledDepartureAt), f.from.timeZone);
}

// 기억 탭 "다가올"의 비행(PRD §3.3.1). 아직 끝나지 않은(출발 전·비행 중)
// 항공편만. 지난 비행은 "지나온"의 비행 기록으로 간다.
export function UpcomingFlights() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const travelerName = useTravelerName();
  const t = useTranslations("flights");
  const fmt = useFormat();
  const now = useNow();
  const listQuery = useFlights();
  const [editing, setEditing] = useState<FlightView | null>(null);
  const deleteMutation = useMutation(
    trpc.flight.delete.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.flight.pathFilter()),
    }),
  );

  const upcoming = (listQuery.data ?? []).filter((f) =>
    ["upcoming", "departingSoon", "inFlight"].includes(flightPhase(f, now)),
  );

  return (
    <Section
      title={t("title")}
      addTitle={t("addTitle")}
      renderAdd={(close) => <FlightForm onDone={close} />}
    >
      {listQuery.isPending ? (
        <LoadingRow />
      ) : upcoming.length === 0 ? (
        <EmptyRow>{t("empty")}</EmptyRow>
      ) : (
        upcoming.map((f) => (
          <div
            key={f.id}
            role="button"
            tabIndex={0}
            className="block w-full cursor-pointer text-left"
            onClick={() => setEditing(f)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setEditing(f);
            }}
            aria-label={t("edit", { flight: f.flightNumber })}
          >
            <Row
              icon={<Plane className="text-dusk-ink size-5" />}
              title={t("row", {
                who: travelerName(f.travelerId),
                from: f.from.city,
                to: f.to.city,
              })}
              sub={`${formatDeparture(fmt, f)} · ${f.flightNumber}`}
              end={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("delete", { flight: f.flightNumber })}
                  className="text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate({ id: f.id });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              }
            />
          </div>
        ))
      )}
      <Drawer open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DrawerContent>
          <DrawerHeader className="pb-4">
            <DrawerTitle>{t("editTitle")}</DrawerTitle>
          </DrawerHeader>
          {editing && <FlightForm initial={editing} onDone={() => setEditing(null)} />}
        </DrawerContent>
      </Drawer>
    </Section>
  );
}

export type FlightFormValues = {
  traveler: "me" | "partner";
  flightNumber: string;
  departureDate: string;
  from: Pick<AirportView, "iata" | "city"> | null;
  to: Pick<AirportView, "iata" | "city"> | null;
  departureTime: string;
  arrivalTime: string;
  source: "manual" | "barcode";
};

function initialValues(initial: FlightView | undefined, currentUserId: string): FlightFormValues {
  if (!initial) {
    return {
      traveler: "me",
      flightNumber: "",
      departureDate: localTodayValue(),
      from: null,
      to: null,
      departureTime: "10:00",
      arrivalTime: "12:00",
      source: "manual",
    };
  }
  const dep = toZonedLocal(new Date(initial.scheduledDepartureAt), initial.from.timeZone);
  const arr = toZonedLocal(new Date(initial.scheduledArrivalAt), initial.to.timeZone);
  return {
    traveler: initial.travelerId === currentUserId ? "me" : "partner",
    flightNumber: initial.flightNumber,
    departureDate: dep.slice(0, 10),
    from: initial.from,
    to: initial.to,
    departureTime: dep.slice(11, 16),
    arrivalTime: arr.slice(11, 16),
    source: "manual",
  };
}

export function FlightForm({ initial, onDone }: { initial?: FlightView; onDone: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { currentUserId } = useSpace();
  const t = useTranslations("flights");
  const tc = useTranslations("common");
  const partnerName = usePartnerName();
  const [v, setV] = useState(() => initialValues(initial, currentUserId));
  const set = (patch: Partial<FlightFormValues>) => setV((prev) => ({ ...prev, ...patch }));

  const onSuccess = () => {
    void queryClient.invalidateQueries(trpc.flight.pathFilter());
    void queryClient.invalidateQueries(trpc.capsule.pathFilter());
    onDone();
  };
  const onError = (err: { message: string }) => toast.error(err.message);
  const create = useMutation(trpc.flight.create.mutationOptions({ onSuccess, onError }));
  const update = useMutation(trpc.flight.update.mutationOptions({ onSuccess, onError }));
  const pending = create.isPending || update.isPending;
  const ready = v.flightNumber.trim() && v.from && v.to;

  return (
    <form
      className="flex min-h-0 flex-col gap-3 overflow-y-auto"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.from || !v.to) return;
        const payload = {
          traveler: v.traveler,
          flightNumber: v.flightNumber,
          departureDate: v.departureDate,
          fromIata: v.from.iata,
          toIata: v.to.iata,
          departureTime: v.departureTime,
          arrivalTime: v.arrivalTime,
          source: v.source,
        };
        if (initial) update.mutate({ ...payload, id: initial.id });
        else create.mutate(payload);
      }}
    >
      <p className="text-muted-foreground text-sm">{t("intro")}</p>
      {!initial && (
        <BoardingPassScan
          onScanned={async (leg) => {
            // 바코드엔 공항 코드만 있다 - 한국어 도시명을 붙이려고 서버에서 찾는다.
            const find = async (iata: string) =>
              (
                await queryClient.fetchQuery(trpc.flight.searchAirports.queryOptions({ q: iata }))
              ).find((a) => a.iata === iata) ?? null;
            const [from, to] = await Promise.all([find(leg.fromIata), find(leg.toIata)]);
            set({
              flightNumber: leg.flightNumber,
              departureDate: leg.departureDate,
              from,
              to,
              source: "barcode",
            });
            toast.success(t("scanned"));
          }}
        />
      )}
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">{t("whoFlies")}</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("whoFlies")}>
          {(
            [
              ["me", tc("me")],
              ["partner", partnerName],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={v.traveler === value}
              onClick={() => set({ traveler: value })}
              className={cn(
                "border-input duration-base ease-standard h-11 rounded-lg border text-base transition-colors",
                v.traveler === value && "border-primary bg-primary/10 font-semibold",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">{t("flightNumber")}</span>
          <Input
            value={v.flightNumber}
            onChange={(e) => set({ flightNumber: e.target.value.toUpperCase() })}
            placeholder="KE081"
            autoCapitalize="characters"
          />
        </label>
        <DateField
          label={t("departureDate")}
          value={v.departureDate}
          onChange={(departureDate) => set({ departureDate })}
        />
      </div>
      <AirportField label={t("from")} value={v.from} onChange={(from) => set({ from })} />
      <AirportField label={t("to")} value={v.to} onChange={(to) => set({ to })} />
      <TimeField
        label={v.from ? t("departureTimeAt", { city: v.from.city }) : t("departureTime")}
        value={v.departureTime}
        onChange={(departureTime) => set({ departureTime })}
      />
      <TimeField
        label={v.to ? t("arrivalTimeAt", { city: v.to.city }) : t("arrivalTime")}
        value={v.arrivalTime}
        onChange={(arrivalTime) => set({ arrivalTime })}
      />
      <Button type="submit" size="lg" className="mt-2" disabled={!ready || pending}>
        {initial ? t("save") : t("register")}
      </Button>
    </form>
  );
}

/** 공항 고르기 - 접힌 상태엔 고른 공항, 누르면 그 자리에서 검색(DateField와 같은 문법). */
function AirportField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Pick<AirportView, "iata" | "city"> | null;
  onChange: (value: Pick<AirportView, "iata" | "city">) => void;
}) {
  const trpc = useTRPC();
  const t = useTranslations("flights");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q.trim());
  const results = useQuery({
    ...trpc.flight.searchAirports.queryOptions({ q: deferred }),
    enabled: open && deferred.length >= 2,
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      {open ? (
        <div className="border-ring flex flex-col rounded-lg border">
          <div className="flex items-center gap-2 px-3">
            <Search className="text-muted-foreground size-4" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("airportSearchPlaceholder")}
              aria-label={t("airportSearch", { label })}
              className="h-11 flex-1 bg-transparent text-base outline-none"
            />
          </div>
          {deferred.length >= 2 && (
            <ul className="border-border max-h-56 overflow-y-auto border-t">
              {(results.data ?? []).map((a) => (
                <li key={a.iata}>
                  <button
                    type="button"
                    className="hover:bg-muted flex w-full items-center gap-3 px-3 py-2 text-left"
                    onClick={() => {
                      onChange({ iata: a.iata, city: a.city });
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    <span className="text-foreground w-10 font-semibold">{a.iata}</span>
                    <span className="text-muted-foreground truncate text-sm">{a.name}</span>
                  </button>
                </li>
              ))}
              {results.data?.length === 0 && (
                <li className="text-muted-foreground px-3 py-2 text-sm">{t("airportNone")}</li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "border-input flex h-11 items-center gap-2 rounded-lg border px-3.5 text-left text-base",
            !value && "text-muted-foreground",
          )}
        >
          {value ? (
            <>
              <span className="font-semibold">{value.iata}</span> {value.city}
            </>
          ) : (
            t("airportPick", { label })
          )}
        </button>
      )}
    </div>
  );
}

const EARTH_CIRCUMFERENCE_KM = 40_075;

// 기억 › 지나온 › "함께 난 하늘"(PRD §3.3.1) - 도착 시각이 지난 비행과 올해
// 서로에게 날아간 거리(공항 사이 대권거리 합). 기록이 없으면 섹션을 숨긴다.
export function FlightHistory() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const travelerName = useTravelerName();
  const t = useTranslations("flights");
  const fmt = useFormat();
  const myTz = useMyTimeZone();
  const now = useNow();
  const listQuery = useFlights();
  const deleteMutation = useMutation(
    trpc.flight.delete.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.flight.pathFilter()),
    }),
  );

  const flown = (listQuery.data ?? []).filter((f) => bestTimes(f).arrivalAt <= now).reverse();
  if (flown.length === 0) return null;

  const thisYear = todayIn(myTz, now).y;
  const thisYearFlights = flown.filter((f) => todayIn(myTz, bestTimes(f).arrivalAt).y === thisYear);
  const km = thisYearFlights.reduce((sum, f) => sum + f.distanceKm, 0);
  const laps = km / EARTH_CIRCUMFERENCE_KM;

  return (
    <Section title={t("historyTitle")}>
      {thisYearFlights.length > 0 && (
        <div className="bg-dusk mb-2 rounded-xl p-5 text-zinc-50">
          <p className="text-sm opacity-80">{t("yearDistance")}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">{fmt.distance(km)}</p>
          <p className="mt-0.5 text-sm opacity-80">
            {[
              t("yearCount", { count: thisYearFlights.length }),
              laps >= 0.1 && t("laps", { laps: laps.toFixed(1) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      )}
      {flown.map((f) => {
        const dep = partsIn(new Date(f.scheduledDepartureAt), f.from.timeZone);
        return (
          <Row
            key={f.id}
            icon={<Plane className="text-dusk-ink size-5" />}
            title={t("row", { who: travelerName(f.travelerId), from: f.from.city, to: f.to.city })}
            sub={`${fmt.ymd(dep, { year: dep.y !== thisYear })} · ${f.flightNumber} · ${fmt.distance(f.distanceKm)}`}
            end={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("historyDelete", { flight: f.flightNumber })}
                className="text-muted-foreground"
                onClick={() => deleteMutation.mutate({ id: f.id })}
              >
                <Trash2 className="size-4" />
              </Button>
            }
          />
        );
      })}
    </Section>
  );
}
