"use client";

import { useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { AttributionControl, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useFormat } from "@/i18n/use-format";
import { dateOnly } from "@/lib/datetime";
import { emberMarkerIcon } from "@/lib/map-markers";

const DEFAULT_CENTER: [number, number] = [36.5, 127.8];

type Pin = { id: string; lat: number; lng: number; label: string; date: Date | string };

export function MeetupMap({ pins }: { pins: Pin[] }) {
  const fmt = useFormat();
  const center = useMemo<[number, number]>(
    () => (pins.length > 0 ? [pins[0].lat, pins[0].lng] : DEFAULT_CENTER),
    [pins],
  );
  const key = useMemo(() => pins.map((p) => p.id).join(","), [pins]);

  if (pins.length === 0) return null;

  return (
    <MapContainer
      key={key}
      center={center}
      zoom={pins.length > 0 ? 8 : 6}
      scrollWheelZoom={false}
      className="hamkke-map h-48 w-full"
      // 모바일은 두 손가락으로 확대한다 - 기본 +/− 버튼은 앱 크롬과 어긋나 뺐다(Find My처럼).
      zoomControl={false}
      attributionControl={false}
      minZoom={1}
      worldCopyJump
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* OSM 저작자 표시는 라이선스상 필수 - 문구만 남기고 토큰 톤으로(globals.css .hamkke-map). */}
      <AttributionControl position="bottomright" prefix={false} />
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={emberMarkerIcon}>
          <Popup>
            {pin.label} · {fmt.ymd(dateOnly(pin.date), { year: true })}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
