#!/usr/bin/env bash
# 웹 e2e 앞에서 포트 점유(3000, 4100)와 로컬 DB·Stripe 시뮬레이터를 준비하고 인자로 받은 명령을 돌린다.
#   - 3000에 다른 체크아웃(worktree)의 서버가 떠 있으면 멈춘다(port-owner.sh).
#   - STRIPE_SECRET_KEY가 없으면 scripts/stripe-sim.mjs(4100)를 테스트 대역으로 띄워
#     키 없이도 구독 시나리오(core-flow)까지 건너뛰지 않고 돌린다.
#   - 직접 띄운 시뮬레이터는 명령이 끝나면 내린다. 로그는 .harness/logs/.
set -uo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd -P)
logs="$root/.harness/logs"
mkdir -p "$logs"

# shellcheck source=port-owner.sh
source "$root/scripts/harness/port-owner.sh"
check_owner 3000 "$root" || exit 1
check_owner 4100 "$root" || exit 1

has_env_key() {
  local key=$1
  [[ -n ${!key:-} && ${!key:-} != *placeholder* ]] && return 0
  [[ -f "$root/.env" ]] && grep -qE "^${key}=[^\"[:space:]].*" "$root/.env" && return 0
  [[ -f "$root/.env.local" ]] && grep -qE "^${key}=[^\"[:space:]].*" "$root/.env.local" && return 0
  return 1
}

if ! has_env_key DATABASE_URL; then
  export DATABASE_URL="postgresql://hamkke:hamkke@localhost:5432/hamkke"
fi
if ! has_env_key AUTH_SECRET; then
  export AUTH_SECRET="hamkke-e2e-local-auth-secret-32bytes-minimum"
fi
if ! has_env_key NEXT_PUBLIC_SUPABASE_URL; then
  export NEXT_PUBLIC_SUPABASE_URL="https://placeholder.invalid"
  export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="placeholder"
  export SUPABASE_SECRET_KEY="placeholder"
fi

(
  cd "$root" &&
    npx prisma generate &&
    npx prisma migrate deploy
) >"$logs/e2e-prepare.log" 2>&1 || {
  echo "with-e2e: DB 마이그레이션 준비가 실패했다. 마지막 로그:" >&2
  tail -n 30 "$logs/e2e-prepare.log" >&2
  exit 1
}

sim_pid=
trap '[[ -n $sim_pid ]] && { kill "$sim_pid" 2>/dev/null; wait "$sim_pid" 2>/dev/null; }' EXIT

if ! has_env_key STRIPE_SECRET_KEY; then
  export STRIPE_SIMULATOR_URL=${STRIPE_SIMULATOR_URL:-http://localhost:4100}
  export STRIPE_SECRET_KEY="sk_test_simulator"
  export STRIPE_WEBHOOK_SECRET="whsec_simulator"
  export STRIPE_PREMIUM_PRICE_ID="price_simulator_premium"
  sim_port=${STRIPE_SIMULATOR_URL##*:}
  if ! curl -sf "$STRIPE_SIMULATOR_URL/__sim/calls" >/dev/null 2>&1; then
    echo "with-e2e: STRIPE_SECRET_KEY가 없어 Stripe 시뮬레이터($STRIPE_SIMULATOR_URL)를 띄운다"
    (cd "$root" && SIM_PORT=$sim_port exec node scripts/stripe-sim.mjs) >"$logs/stripe-sim.log" 2>&1 &
    sim_pid=$!
    for _ in $(seq 1 30); do
      curl -sf "$STRIPE_SIMULATOR_URL/__sim/calls" >/dev/null 2>&1 && break
      sleep 0.2
    done
  fi
fi

"$@"
