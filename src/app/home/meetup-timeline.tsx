"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapPin, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateField, localTodayValue } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { useFormat } from "@/i18n/use-format";
import { dateOnly } from "@/lib/datetime";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, LoadingRow, Row, Section } from "./memories/section";
import { UpgradeHint } from "./upgrade-hint";

const MeetupMap = dynamic(() => import("./meetup-map").then((m) => m.MeetupMap), { ssr: false });

// 실제로 같이 만났던 장소를 지도 핀 + 타임라인으로 기록한다(PRD.md §3.3).
export function MeetupTimeline() {
  const trpc = useTRPC();
  const t = useTranslations("meetups");
  const tm = useTranslations("memories");
  const fmt = useFormat();
  const listQuery = useQuery(trpc.meetup.list.queryOptions());
  const deleteMutation = useMutation(
    trpc.meetup.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );
  const pins = listQuery.data ?? [];

  return (
    <Section
      title={pins.length > 0 ? t("titleCount", { count: pins.length }) : t("title")}
      addTitle={t("addTitle")}
      renderAdd={(close) => <MeetupForm onDone={close} onCreated={() => listQuery.refetch()} />}
    >
      {listQuery.isPending ? (
        <LoadingRow />
      ) : pins.length === 0 ? (
        <EmptyRow>{t("empty")}</EmptyRow>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg">
            <MeetupMap pins={pins} />
          </div>
          <div className="mt-2">
            {pins.map((pin) => (
              <Row
                key={pin.id}
                icon={<MapPin className="text-ember size-5" />}
                title={pin.label}
                sub={fmt.ymd(dateOnly(pin.date), { year: true })}
                end={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tm("delete", { title: pin.label })}
                    className="text-muted-foreground"
                    onClick={() => deleteMutation.mutate({ id: pin.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

function MeetupForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const trpc = useTRPC();
  const t = useTranslations("meetups");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(() => localTodayValue());
  const [registering, setRegistering] = useState(false);
  const createMutation = useMutation(
    trpc.meetup.create.mutationOptions({
      onSuccess: () => {
        onCreated();
        onDone();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  function handleRegister() {
    if (!label.trim()) return;
    if (!("geolocation" in navigator)) {
      toast.error(t("noGeo"));
      return;
    }
    setRegistering(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        createMutation.mutate({
          label: label.trim(),
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          date,
        });
        setRegistering(false);
      },
      () => {
        toast.error(t("geoFailed"));
        setRegistering(false);
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <UpgradeHint usageKey="meetupPins" />
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("placeholder")}
      />
      <DateField label={t("dateLabel")} value={date} onChange={setDate} />
      <Button
        type="button"
        size="lg"
        onClick={handleRegister}
        disabled={!label.trim() || registering || createMutation.isPending}
      >
        <MapPin className="size-5" /> {t("saveHere")}
      </Button>
    </div>
  );
}
