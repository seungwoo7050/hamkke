#!/usr/bin/env bash
# design-guard.sh: Hamkke 디자인·프라이버시 무결성 검사
# 1. AI 슬롭 그라데이션·보라색 클래스 차단 (bg-gradient-to-, from-purple-, from-indigo-, via-purple-, to-purple-, to-indigo-)
# 2. 인터랙티브 요소(<button, <Button, <nav, <input, <select, <textarea)에 손글씨 폰트(font-handwritten) 사용 차단 (DESIGN.md 3.2절)
# 3. 가짜 메타 슬롭 문구(SYS.36, ARCH-01 등) 차단
# 4. Sentry 설정(src/lib/sentry-options.ts)의 개인정보 마스킹(beforeSend: scrubEvent, sendDefaultPii: false) 불변식 검사

set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
target_dir="${1:-$root}"

fail=0

# 1. AI 슬롭 그라데이션·보라색 클래스 검사
slop_patterns="bg-gradient-to-|from-purple-|from-indigo-|via-purple-|to-purple-|to-indigo-"
found_slop=$(grep -E -rn "$slop_patterns" "$target_dir/src/app" "$target_dir/src/components" 2>/dev/null \
  | grep -v "\.test\." \
  | grep -v "\.spec\." \
  || true)

if [[ -n "$found_slop" ]]; then
  echo "FAIL [design-guard] AI 슬롭 그라데이션·보라색 클래스가 발견되었습니다:"
  echo "$found_slop"
  fail=1
fi

# 2. 인터랙티브 요소에 손글씨 폰트(font-handwritten) 사용 차단 (DESIGN.md 3.2절)
found_handwritten=$(grep -E -rn '<(button|Button|nav|input|Input|select|textarea|Textarea)\b[^>]*font-handwritten' "$target_dir/src/app" "$target_dir/src/components" 2>/dev/null \
  | grep -v "\.test\." \
  || true)

if [[ -n "$found_handwritten" ]]; then
  echo "FAIL [design-guard] 인터랙티브 요소에 font-handwritten이 사용되었습니다 (DESIGN.md 3.2절 위반):"
  echo "$found_handwritten"
  fail=1
fi

# 3. 가짜 메타 슬롭 문구 금지
slop_meta_patterns='SYS\.[0-9]|ARCH-[0-9]|DATASHEET|TELEMETRY|標本|EDITION 0[0-9] //|\[SYSTEM\]'
found_meta_slop=$(grep -E -rn "$slop_meta_patterns" "$target_dir/src/app" "$target_dir/src/components" 2>/dev/null \
  | grep -v "\.test\." \
  || true)

if [[ -n "$found_meta_slop" ]]; then
  echo "FAIL [design-guard] 가짜 메타 슬롭 문구가 발견되었습니다:"
  echo "$found_meta_slop"
  fail=1
fi

# 4. Sentry 개인정보 마스킹 불변식 검사
sentry_file="$target_dir/src/lib/sentry-options.ts"
if [[ -f "$sentry_file" ]]; then
  if ! grep -qE "beforeSend:\s*scrubEvent" "$sentry_file" || ! grep -qE "sendDefaultPii:\s*false" "$sentry_file"; then
    echo "FAIL [design-guard] sentry-options.ts에 beforeSend: scrubEvent 또는 sendDefaultPii: false가 누락되었습니다."
    fail=1
  fi
fi

if [[ $fail -eq 0 ]]; then
  echo "ok   [design-guard] 모든 디자인·프라이버시 가드 검사 통과"
  exit 0
else
  exit 1
fi
