"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

const MeetupMap = dynamic(() => import("./meetup-map").then((m) => m.MeetupMap), { ssr: false });

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

// 실제로 같이 만났던 장소를 지도 핀 + 타임라인으로 기록한다(PRD.md §3.3).
export function MeetupTimeline() {
  const trpc = useTRPC();
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [registering, setRegistering] = useState(false);

  const listQuery = useQuery(trpc.meetup.list.queryOptions());
  const createMutation = useMutation(
    trpc.meetup.create.mutationOptions({
      onSuccess: () => {
        setLabel("");
        listQuery.refetch();
      },
    }),
  );
  const deleteMutation = useMutation(
    trpc.meetup.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
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
    <div className="border-border border-b px-6 py-3">
      <p className="text-foreground mb-2 text-xs font-medium">만남 지도</p>
      <div className="mb-2 flex flex-wrap gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="예: 첫 데이트 카페"
          className="max-w-40"
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="max-w-36"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRegister}
          disabled={!label.trim() || registering || createMutation.isPending}
        >
          <MapPin /> 현재 위치로 기록
        </Button>
      </div>

      {listQuery.data && listQuery.data.length > 0 && (
        <>
          <MeetupMap pins={listQuery.data} />
          <ul className="mt-2 flex flex-col gap-1">
            {listQuery.data.map((pin) => (
              <li
                key={pin.id}
                className="text-muted-foreground flex items-center justify-between text-xs"
              >
                <span>
                  {new Date(pin.date).toLocaleDateString("ko-KR")} · {pin.label}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`${pin.label} 삭제`}
                  onClick={() => deleteMutation.mutate({ id: pin.id })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
