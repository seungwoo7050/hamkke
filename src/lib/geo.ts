const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

/** 두 좌표 사이의 직선거리(km)를 Haversine 공식으로 계산한다. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * 지도에 두 점을 함께 그릴 때 point의 경도를 base에서 180° 안쪽으로 옮긴다.
 * 경도를 그대로 쓰면 서울(127°E)–LA(118°W)처럼 날짜변경선을 사이에 둔 두 점의
 * 범위가 가까운 태평양이 아니라 지구 반대편으로 잡힌다. Leaflet은 360°를 넘는
 * 경도도 옆 지도 사본에 그대로 그린다(비행 경로의 경도 이어 붙이기와 같다).
 */
export function nearSideOf<T extends { lat: number; lng: number }>(base: T, point: T): T {
  let lng = point.lng;
  while (lng - base.lng > 180) lng -= 360;
  while (lng - base.lng < -180) lng += 360;
  return lng === point.lng ? point : { ...point, lng };
}

// 먼 거리(100km 이상)에서 소수점은 의미 없는 정밀도라 정수로 반올림한다 -
// 장거리 커플에게 "11,052.6km"의 0.6은 정보가 아니라 소음이다.
export function formatDistanceKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toLocaleString("ko-KR", { maximumFractionDigits: km >= 100 ? 0 : 1 })}km`;
}

// "이동 패턴 감지"는 속도/경로 예측 없이, 거리 임계값 + 직전 측정 대비
// 좁혀지는 추세만 본다(PRD.md §3.3 범위, 과한 엔지니어링 방지).
export const MEETING_SOON_THRESHOLD_KM = 3;

export function isMeetingSoon(distance: number, threshold = MEETING_SOON_THRESHOLD_KM) {
  return distance <= threshold;
}
