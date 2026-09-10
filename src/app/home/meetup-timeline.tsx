"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/use-hydrated";
import { useTRPC } from "@/trpc/client";
import { EmptyRow, Row, Section } from "./memories/section";
import { UpgradeHint } from "./upgrade-hint";

const MeetupMap = dynamic(() => import("./meetup-map").then((m) => m.MeetupMap), { ssr: false });

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

// 실제로 같이 만났던 장소를 지도 핀 + 타임라인으로 기록한다(PRD.md §3.3).
export function MeetupTimeline() {
  const trpc = useTRPC();
  const hydrated = useHydrated();
  const listQuery = useQuery(trpc.meetup.list.queryOptions());
  const deleteMutation = useMutation(
    trpc.meetup.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
  );
  const pins = listQuery.data ?? [];

  return (
    <Section
      title={pins.length > 0 ? `함께한 곳 ${pins.length}곳` : "함께한 곳"}
      addTitle="지금 있는 곳 기록하기"
      renderAdd={(close) => <MeetupForm onDone={close} onCreated={() => listQuery.refetch()} />}
    >
      {pins.length === 0 ? (
        <EmptyRow>만났을 때 지금 있는 곳을 남겨두면 지도에 쌓여요</EmptyRow>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg">
            <MeetupMap pins={pins} />
          </div>
          <div className="mt-2">
            {hydrated &&
              pins.map((pin) => (
                <Row
                  key={pin.id}
                  icon={<MapPin className="text-ember size-5" />}
                  title={pin.label}
                  sub={new Date(pin.date).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  end={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${pin.label} 삭제`}
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
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayInputValue);
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
      toast.error("이 브라우저는 위치를 가져올 수 없어요");
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
        toast.error("현재 위치를 가져오지 못했어요");
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
        placeholder="예: 첫 데이트 카페"
      />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button
        type="button"
        size="lg"
        onClick={handleRegister}
        disabled={!label.trim() || registering || createMutation.isPending}
      >
        <MapPin className="size-5" /> 지금 있는 곳으로 기록
      </Button>
    </div>
  );
}
