"use client";

import { MapPin } from "lucide-react";
import { formatDistanceKm } from "@/lib/geo";
import { useDistance } from "./location-context";
import { LocationSheet } from "./location-sheet";

// 두 사람 사이 거리 — 누르면 위치 시트(지도)가 열린다. "우리" 장면 커밋에서
// 장면 한가운데 워드마크 pill로 옮겨간다.
export function DistanceButton() {
  const { km } = useDistance();
  return (
    <LocationSheet>
      <button
        type="button"
        className="text-foreground hover:bg-muted duration-fast ease-standard mx-4 my-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
      >
        <MapPin className="text-dusk size-5" />
        {km !== null ? formatDistanceKm(km) : "거리 보기"}
      </button>
    </LocationSheet>
  );
}
