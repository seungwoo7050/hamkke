#!/usr/bin/env bash
# 배포 스모크 테스트: 주소 하나가 실제로 요청을 받는지 본다(CI deploy job이 쓴다).
#   /api/health    서버가 뜨고 운영 DB에 닿는가(200 ok / 503)
#   /login         페이지가 그려지는가(인증 설정이 깨지면 여기서 500)
#   /legal/privacy 로그인 없이 열려야 하는 정책 문서
#
# 사용: scripts/smoke-deploy.sh https://hamkke-abc123.vercel.app
# Vercel 배포 보호가 켜져 있으면 배포마다 생기는 주소는 401을 준다. 그때는
# VERCEL_AUTOMATION_BYPASS_SECRET(Project Settings → Deployment Protection →
# Protection Bypass for Automation)을 넣으면 우회 헤더로 보낸다.
set -euo pipefail

base="${1:?배포 주소가 필요하다(예: https://hamkke-abc123.vercel.app)}"
base="${base%/}"

headers=()
if [ -n "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]; then
  headers=(-H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET")
fi

check() {
  local path="$1" code=""
  # 막 만든 배포는 첫 요청이 콜드 스타트라 몇 번 다시 시도한다.
  for i in 1 2 3 4 5 6; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 ${headers[@]+"${headers[@]}"} "$base$path" || true)
    [ "$code" = "200" ] && { echo "$path $code"; return 0; }
    echo "$path $code ($i) 다시 시도"
    sleep 5
  done
  if [ "$code" = "401" ]; then
    echo "::error::${path}가 401 - 배포 보호에 막혔다. VERCEL_AUTOMATION_BYPASS_SECRET 시크릿을 넣는다."
  else
    echo "::error::${path}가 ${code}를 줬다."
  fi
  return 1
}

check /api/health
check /login
check /legal/privacy
