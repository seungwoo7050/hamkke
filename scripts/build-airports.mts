/**
 * 공항 데이터 번들 생성(PRD §3.3.1 비행) — mwgg/Airports(MIT,
 * https://github.com/mwgg/Airports)에서 IATA 코드가 있는 공항만 골라
 * [IATA, 도시, 이름, 국가, 위도, 경도, IANA 시간대]로 줄여 src/data/airports.json에
 * 쓴다. API 키·런타임 네트워크 없이 서버가 공항 좌표·시간대를 안다.
 *
 * 실행: npx tsx scripts/build-airports.mts
 */
import { writeFileSync } from "node:fs";

type Raw = {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
};

const SOURCE = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";

function validTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const raw = (await (await fetch(SOURCE)).json()) as Record<string, Raw>;
const seen = new Set<string>();
const rows = Object.values(raw)
  .filter((a) => /^[A-Z]{3}$/.test(a.iata ?? "") && a.tz && validTimeZone(a.tz))
  .filter((a) => (seen.has(a.iata) ? false : (seen.add(a.iata), true)))
  .sort((a, b) => a.iata.localeCompare(b.iata))
  .map((a) => [
    a.iata,
    a.city || a.name,
    a.name,
    a.country,
    Math.round(a.lat * 1e4) / 1e4,
    Math.round(a.lon * 1e4) / 1e4,
    a.tz,
  ]);

writeFileSync(
  new URL("../src/data/airports.json", import.meta.url),
  JSON.stringify({ source: SOURCE, license: "MIT (c) 2014 mwgg", rows }) + "\n",
);
console.log(`공항 ${rows.length}곳`);
