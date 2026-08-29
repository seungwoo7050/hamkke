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

export function formatDistanceKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}km`;
}
