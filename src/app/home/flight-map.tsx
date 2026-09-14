"use client";

import { useMemo } from "react";
import L, { latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import { AttributionControl, MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import { greatCirclePath, greatCirclePoint } from "@/lib/flight";

type LatLng = { lat: number; lng: number };

// lucide "plane"과 같은 모양. 아이콘은 오른쪽 위(45°)를 향해 그려져 있어,
// 진행 방향(북쪽 기준 방위)에서 45°를 빼서 돌린다.
const PLANE_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

function planeIcon(bearing: number) {
  return L.divIcon({
    className: "",
    html: `<svg width="28" height="28" viewBox="0 0 24 24" style="transform:rotate(${bearing - 45}deg);color:var(--dusk-ink)" fill="currentColor" stroke="var(--background)" stroke-width="1"><path d="${PLANE_PATH}"/></svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function airportIcon(filled: boolean) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;border:3px solid var(--dusk-ink);background:${filled ? "var(--dusk-ink)" : "var(--background)"}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// 화면 방위(위쪽 0°, 시계 방향) — 지도가 메르카토르라 짧은 구간에선 충분하다.
function screenBearing(a: [number, number], b: [number, number]) {
  const dy = b[0] - a[0];
  const dx = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * 위치 시트의 비행 지도(PRD §3.3.1) — 대권 경로(지나온 부분은 실선, 남은
 * 부분은 점선)와 예정 시각으로 계산한 추정 위치. 실제 항적이 아니다.
 */
export function FlightMap({ from, to, progress }: { from: LatLng; to: LatLng; progress: number }) {
  const path = useMemo(() => greatCirclePath(from, to, 96), [from, to]);
  const split = Math.max(1, Math.round(progress * (path.length - 1)));
  const flown = path.slice(0, split + 1);
  const remaining = path.slice(split);
  const here = greatCirclePoint(from, to, progress);
  // 날짜변경선을 넘은 경로는 경도가 이어 붙어 있으므로 비행기 위치도 같은 쪽으로.
  const herePoint: [number, number] = flown[flown.length - 1] ?? [here.lat, here.lng];
  const ahead = path[Math.min(path.length - 1, split + 1)];
  const bearing = screenBearing(flown[Math.max(0, flown.length - 2)], ahead);
  const bounds = latLngBounds(path).pad(0.15);
  const end = path[path.length - 1];

  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      className="hamkke-map h-64 w-full"
      zoomControl={false}
      attributionControl={false}
      minZoom={1}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AttributionControl position="bottomright" prefix={false} />
      <Polyline positions={remaining} pathOptions={{ className: "flight-path-remaining" }} />
      <Polyline positions={flown} pathOptions={{ className: "flight-path-flown" }} />
      <Marker position={path[0]} icon={airportIcon(true)} />
      <Marker position={end} icon={airportIcon(false)} />
      <Marker position={herePoint} icon={planeIcon(bearing)} />
    </MapContainer>
  );
}
