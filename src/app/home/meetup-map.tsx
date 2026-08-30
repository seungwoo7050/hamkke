"use client";

import { useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER: [number, number] = [36.5, 127.8];

type Pin = { id: string; lat: number; lng: number; label: string; date: Date | string };

export function MeetupMap({ pins }: { pins: Pin[] }) {
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
      className="h-64 w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={markerIcon}>
          <Popup>
            {pin.label} · {new Date(pin.date).toLocaleDateString("ko-KR")}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
