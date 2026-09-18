"use client";

import { useMemo } from "react";
import { latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslations } from "next-intl";
import { AttributionControl, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { duskMarkerIcon, emberMarkerIcon } from "@/lib/map-markers";

type LatLng = { lat: number; lng: number };

const DEFAULT_CENTER: LatLng = { lat: 36.5, lng: 127.8 };

// 2인 전용 앱이라 트래픽이 극히 적어 OpenStreetMap 공개 타일을 API 키 없이
// 바로 쓴다. 실제 배포 후 트래픽이 늘면 상용 타일(Mapbox 등)로 전환을
// 검토한다(docs/COMMIT_PLAN.md Phase 3 각주 참고).
// 두 사람이 모두 있으면 둘 다 보이게 범위를 맞추고(장거리라 한쪽 중심 고정
// 줌이면 상대가 화면 밖에 있다), 한 명뿐이면 그 사람 중심으로 가까이 본다.
export function LocationMap({ me, partner }: { me: LatLng | null; partner: LatLng | null }) {
  const t = useTranslations("common");
  const center = me ?? partner ?? DEFAULT_CENTER;
  const hasAnyPoint = me !== null || partner !== null;
  const bounds =
    me && partner ? latLngBounds([me.lat, me.lng], [partner.lat, partner.lng]).pad(0.3) : undefined;

  const key = useMemo(
    () => `${me?.lat},${me?.lng}-${partner?.lat},${partner?.lng}`,
    [me?.lat, me?.lng, partner?.lat, partner?.lng],
  );

  return (
    <MapContainer
      key={key}
      // react-leaflet은 center/zoom이 있으면 bounds를 무시하므로 둘 중 하나만 준다.
      {...(bounds ? { bounds } : { center: [center.lat, center.lng], zoom: hasAnyPoint ? 11 : 6 })}
      scrollWheelZoom={false}
      className="hamkke-map h-64 w-full"
      // 모바일은 두 손가락으로 확대한다 — 기본 +/− 버튼은 앱 크롬과 어긋나 뺐다(Find My처럼).
      zoomControl={false}
      attributionControl={false}
      minZoom={1}
      worldCopyJump
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* OSM 저작자 표시는 라이선스상 필수 — 문구만 남기고 토큰 톤으로(globals.css .hamkke-map). */}
      <AttributionControl position="bottomright" prefix={false} />
      {me && (
        <Marker position={[me.lat, me.lng]} icon={emberMarkerIcon}>
          <Popup>{t("me")}</Popup>
        </Marker>
      )}
      {partner && (
        <Marker position={[partner.lat, partner.lng]} icon={duskMarkerIcon}>
          <Popup>{t("partner")}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
