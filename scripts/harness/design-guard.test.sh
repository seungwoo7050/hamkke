#!/usr/bin/env bash
# design-guard.test.sh: design-guard.sh 검증 테스트
# 막아야 할 입력은 exit 1, 정상 입력은 exit 0인지 확인한다.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
guard="$here/design-guard.sh"
fail=0

tmpdir=$(mktemp -d "/tmp/design-guard-test-XXXXXX")
trap 'rm -rf "$tmpdir"' EXIT

expect() {
  local want=$1 desc=$2 dir=$3 got
  "$guard" "$dir" >/dev/null 2>&1
  got=$?
  if [[ $got -eq "$want" ]]; then
    echo "ok   $desc"
  else
    echo "FAIL $desc (기대: $want, 실제: $got)"
    fail=1
  fi
}

echo "# 1. 현재 코드베이스 검사"
expect 0 "현재 저장소 hamkke 통과" "$root"

echo "# 2. AI 슬롭 클래스 차단 검사"
mkdir -p "$tmpdir/test-slop/src/app" "$tmpdir/test-slop/src/components"
echo '<div className="bg-surface rounded-2xl p-4">clean</div>' > "$tmpdir/test-slop/src/app/page.tsx"
expect 0 "슬롭 없는 정상 마크업 통과" "$tmpdir/test-slop"

for slop in "bg-gradient-to-r" "from-purple-500" "from-indigo-600" "to-purple-400"; do
  echo "<div className=\"$slop\">slop</div>" > "$tmpdir/test-slop/src/app/page.tsx"
  expect 1 "슬롭 클래스 ($slop) 감지 및 차단" "$tmpdir/test-slop"
done

echo "# 3. 인터랙티브 요소 font-handwritten 차단 검사"
mkdir -p "$tmpdir/test-font/src/app" "$tmpdir/test-font/src/components"
echo '<p className="font-handwritten text-lg">감성 한 줄</p>' > "$tmpdir/test-font/src/app/page.tsx"
expect 0 "문단(<p>)의 font-handwritten 허용" "$tmpdir/test-font"

echo '<button className="font-handwritten px-4">눌러요</button>' > "$tmpdir/test-font/src/app/page.tsx"
expect 1 "<button>의 font-handwritten 차단" "$tmpdir/test-font"

echo '<input className="font-handwritten" />' > "$tmpdir/test-font/src/app/page.tsx"
expect 1 "<input>의 font-handwritten 차단" "$tmpdir/test-font"

echo "# 4. 가짜 메타 문구 차단 검사"
mkdir -p "$tmpdir/test-meta/src/app" "$tmpdir/test-meta/src/components"
echo 'export const label = "지금 우리";' > "$tmpdir/test-meta/src/app/page.tsx"
expect 0 "정상 한국어 UI 라벨 통과" "$tmpdir/test-meta"

for meta in "SYS.36" "ARCH-01" "DATASHEET" "TELEMETRY" "[SYSTEM]"; do
  echo "export const label = '$meta';" > "$tmpdir/test-meta/src/app/page.tsx"
  expect 1 "가짜 메타 문구 ($meta) 감지 및 차단" "$tmpdir/test-meta"
done

echo "# 5. Sentry 개인정보 마스킹 불변식 검사"
mkdir -p "$tmpdir/test-sentry/src/lib" "$tmpdir/test-sentry/src/app"
cat << 'EOF' > "$tmpdir/test-sentry/src/lib/sentry-options.ts"
export const sentryOptions = {
  sendDefaultPii: false,
  beforeSend: scrubEvent,
};
EOF
expect 0 "scrubEvent와 sendDefaultPii: false가 있는 sentry-options.ts 통과" "$tmpdir/test-sentry"

cat << 'EOF' > "$tmpdir/test-sentry/src/lib/sentry-options.ts"
export const sentryOptions = {
  sendDefaultPii: true,
};
EOF
expect 1 "scrubEvent가 빠진 sentry-options.ts 차단" "$tmpdir/test-sentry"

exit $fail
