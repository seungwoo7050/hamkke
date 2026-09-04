import L from "leaflet";

/**
 * Leaflet 기본 마커(외부 unpkg PNG, 파란색 고정)는 브랜드 색상과 무관하고
 * "나"/"상대방"을 구분할 수도 없었다. Wordmark의 두 사람 실루엣과 같은
 * ember/dusk 색으로 구분되는 핀을 CSS로 직접 그려 대체한다(DESIGN.md §1).
 */
function pinDivIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:block;width:20px;height:20px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);background:${color};
      border:2px solid var(--background, #fff);
      box-shadow:0 1px 3px rgba(0,0,0,0.35);
    "></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -22],
  });
}

export const emberMarkerIcon = pinDivIcon("var(--color-ember, #f2653a)");
export const duskMarkerIcon = pinDivIcon("var(--color-dusk, #4b4468)");
