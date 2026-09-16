"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

// 상대가 이 장소들 중 하나의 반경 안에 들어오면 도착 알림이 간다(위치
// 전송 때마다 서버가 확인 — src/server/trpc/routers/location.ts 참고).
// 한 번 등록하면 거의 안 건드리는 설정이라 설정 시트 안에 둔다(DESIGN.md §4).
export function GeofenceManager() {
  const trpc = useTRPC();
  const t = useTranslations("geofence");
  const tm = useTranslations("memories");
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
        });
        setRegistering(false);
      },
      () => {
        toast.error(t("geoFailed"));
        setRegistering(false);
      },
    );
  }

  const fences = listQuery.data ?? [];

  return (
    <div className="flex gap-3 py-3">
      <BellRing className="text-dusk-ink mt-0.5 size-5" />
      <div className="flex flex-1 flex-col gap-2">
        <div>
          <p className="text-foreground text-base font-medium">{t("title")}</p>
          <p className="text-muted-foreground text-sm">{t("sub")}</p>
        </div>
        {fences.length > 0 && (
          <ul className="flex flex-col">
            {fences.map((fence) => (
              <li key={fence.id} className="flex items-center justify-between text-sm">
                <span>{fence.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={tm("delete", { title: fence.label })}
                  onClick={() => deleteMutation.mutate({ id: fence.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("placeholder")}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleRegister}
            disabled={!label.trim() || registering || createMutation.isPending}
          >
            {t("register")}
          </Button>
        </div>
      </div>
    </div>
  );
}
