#!/usr/bin/env bash
# PostToolUse 훅: 방금 쓴 파일 하나를 ESLint로 검사한다.
# 오류나 경고가 하나라도 있으면(--max-warnings 0) exit 2와 stderr의 린터 출력을 에이전트에게
# 돌려준다(파일은 이미 쓰였다). 깨끗하거나 대상이 아니면 조용히 exit 0.
set -uo pipefail

input=$(cat)
path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
cwd=$(jq -r '.cwd // ""' <<<"$input")
[[ -n "$path" ]] || exit 0
[[ $path == /* ]] || path="${cwd:-$PWD}/$path"
[[ -f "$path" ]] || exit 0

dir=$(cd "$(dirname "$path")" && pwd -P)
root=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || exit 0
root=$(cd "$root" && pwd -P)
if [[ $dir == "$root" ]]; then
  rel=$(basename "$path")
elif [[ $dir == "$root"/* ]]; then
  rel="${dir#"$root"/}/$(basename "$path")"
else
  exit 0
fi

case $rel in
  src/generated/* | android/* | ios/* | .next/* | node_modules/*)
    exit 0 ;;
  src/*.ts | src/*.tsx | e2e/*.ts | scripts/*.mts | scripts/*.mjs)
    ;;
  *)
    exit 0 ;;
esac

linter="$root/node_modules/.bin/eslint"
[[ -x "$linter" ]] || exit 0

out=$(cd "$root" && "$linter" --max-warnings 0 "$rel" 2>&1)
status=$?
if ((status != 0)); then
  {
    echo "eslint가 ${rel} 에서 린트 오류·경고를 찾았다. 고친 뒤 이어 가라."
    echo "$out" | tail -n 40
  } >&2
  exit 2
fi
exit 0
