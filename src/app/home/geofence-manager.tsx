"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

// 상대가 이 장소들 중 하나의 반경 안에 들어오면 도착 알림이 간다(위치
// 전송 때마다 서버가 확인 — src/server/trpc/routers/location.ts 참고).
export function GeofenceManager() {
  const trpc = useTRPC();
  const [label, setLabel] = useState("");
  const [registering, setRegistering] = useState(false);

  const listQuery = useQuery(trpc.geofence.list.queryOptions());
  const createMutation = useMutation(
    trpc.geofence.create.mutationOptions({
      onSuccess: () => {
        setLabel("");
        listQuery.refetch();
      },
    }),
  );
  const deleteMutation = useMutation(
    trpc.geofence.delete.mutationOptions({ onSuccess: () => listQuery.refetch() }),
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
      <p className="text-foreground mb-2 text-xs font-medium">도착 알림 장소</p>
      <div className="mb-2 flex gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="예: 집, 공항"
          className="max-w-40"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRegister}
          disabled={!label.trim() || registering || createMutation.isPending}
        >
          <MapPin /> 현재 위치로 등록
        </Button>
      </div>
      {listQuery.data && listQuery.data.length > 0 && (
        <ul className="flex flex-col gap-1">
          {listQuery.data.map((fence) => (
            <li
              key={fence.id}
              className="text-muted-foreground flex items-center justify-between text-xs"
            >
              <span>{fence.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${fence.label} 삭제`}
                onClick={() => deleteMutation.mutate({ id: fence.id })}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
