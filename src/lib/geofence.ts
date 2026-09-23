// 지오펜스 안/밖 판정. 좌표는 accuracy(m)만큼 흔들리므로 단일 경계로 가르면
// 경계 근처에 머무는 동안 안↔밖이 반복되고, 안으로 바뀔 때마다 도착 알림이
// 다시 간다. 들어올 때는 반경, 나갈 때는 반경 + 여유 + 정확도를 넘어야 하도록
// 기준을 둘로 나눈다(히스테리시스).
export const GEOFENCE_EXIT_MARGIN_M = 50;

export function nextGeofenceState(
  fence: { radiusM: number; isInside: boolean },
  distanceM: number,
  accuracyM = 0,
) {
  // 반경보다 넓게 흔들리는 좌표(실내·기지국 위치)로는 안인지 밖인지 말할 수 없다.
  if (accuracyM > fence.radiusM) return fence.isInside;
  if (!fence.isInside) return distanceM <= fence.radiusM;
  return !(distanceM - accuracyM > fence.radiusM + GEOFENCE_EXIT_MARGIN_M);
}
