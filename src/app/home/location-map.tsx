"use client";

import { useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { duskMarkerIcon, emberMarkerIcon } from "@/lib/map-markers";

type LatLng = { lat: number; lng: number };

const DEFAULT_CENTER: LatLng = { lat: 36.5, lng: 127.8 };

// 2인 전용 앱이라 트래픽이 극히 적어 OpenStreetMap 공개 타일을 API 키 없이
// 바로 쓴다. 실제 배포 후 트래픽이 늘면 상용 타일(Mapbox 등)로 전환을
// 검토한다(docs/COMMIT_PLAN.md Phase 3 각주 참고).
export function LocationMap({ me, partner }: { me: LatLng | null; partner: LatLng | null }) {
  const center = me ?? partner ?? DEFAULT_CENTER;
  const hasAnyPoint = me !== null || partner !== null;

  const key = useMemo(
    () => `${me?.lat},${me?.lng}-${partner?.lat},${partner?.lng}`,
    [me?.lat, me?.lng, partner?.lat, partner?.lng],
  );

  return (
    <MapContainer
      key={key}
      center={[center.lat, center.lng]}
      zoom={hasAnyPoint ? 11 : 6}
      scrollWheelZoom={false}
      className="h-64 w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {me && (
        <Marker position={[me.lat, me.lng]} icon={emberMarkerIcon}>
          <Popup>나</Popup>
        </Marker>
      )}
      {partner && (
        <Marker position={[partner.lat, partner.lng]} icon={duskMarkerIcon}>
          <Popup>상대방</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
