// Stripe 시뮬레이터(테스트 대역). stripe SDK가 protocol/host/port로 이 서버를 부른다(STRIPE_SIMULATOR_URL).
//   고객·구독: POST/GET/DELETE /v1/customers, POST/GET/DELETE /v1/subscriptions, GET /v1/prices/{id}
//   Checkout·Portal: POST/GET /v1/checkout/sessions, GET /v1/checkout/sessions/{id}, POST /v1/checkout/sessions/{id}/expire,
//                    결제창 /c/pay/{id}, POST /v1/billing_portal/sessions
//   결제·청구서·환불: GET /v1/payment_intents/{id}, GET /v1/invoice_payments, POST /v1/refunds, GET /v1/refunds
//   제어(테스트용, /__sim): faults, calls, reset
// 실행: SIM_PORT=4100 SIM_API_URL=http://localhost:3000 node scripts/stripe-sim.mjs  (SIM_PORT=0이면 빈 포트)
import { createServer } from "node:http";
import Stripe from "stripe";

const PORT = Number(process.env.SIM_PORT ?? 4100);
const API = process.env.SIM_API_URL ?? "http://localhost:3000";
const LATENCY_MS = Number(process.env.SIM_LATENCY_MS ?? 0);
const WEBHOOK_DELAY_MS = Number(process.env.SIM_WEBHOOK_DELAY_MS ?? 1000);
const SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_simulator";

const customers = new Map();
const subscriptions = new Map();
const invoices = new Map();
const charges = new Map();
const sessions = new Map();
const intents = new Map();
const refunds = new Map();
const idempotent = new Map();
let faults = [];
let calls = { refund: 0, fetch: 0, session: 0, list: 0 };
let seq = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readForm(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return new URLSearchParams(body);
}

function readMetadata(form, prefix = "metadata") {
  const metadata = {};
  const re = new RegExp(`^${prefix.replace(/[[\]]/g, "\\$&")}\\[([^\\]]+)\\]$`);
  for (const [k, v] of form) {
    const m = k.match(re);
    if (m) metadata[m[1]] = v;
  }
  return metadata;
}

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const invalid = (message, code) => ({
  status: 400,
  body: { error: { type: "invalid_request_error", code, message } },
});

function takeFault(op) {
  const i = faults.findIndex((f) => f.op === op);
  if (i < 0) return undefined;
  const f = faults[i];
  if (--f.times <= 0) faults.splice(i, 1);
  return f;
}

const sessionView = (s) => ({
  id: s.id,
  object: "checkout.session",
  mode: s.mode ?? "subscription",
  url: s.status === "open" ? `http://localhost:${server.address().port}/c/pay/${s.id}` : null,
  payment_status: s.paymentIntent ? "paid" : "unpaid",
  status: s.status ?? (s.paymentIntent ? "complete" : "open"),
  amount_total: s.amount,
  currency: "krw",
  customer: s.customer ?? null,
  client_reference_id: s.orderId ?? null,
  success_url: s.successUrl,
  cancel_url: s.cancelUrl,
  metadata: s.metadata ?? {},
  payment_intent: s.paymentIntent ?? null,
});

function createPaidIntent(amount, metadata = {}) {
  const now = Math.floor(Date.now() / 1000);
  const chargeId = `ch_sim_${Date.now()}_${++seq}`;
  const piId = `pi_sim_${Date.now()}_${++seq}`;
  charges.set(chargeId, {
    id: chargeId,
    object: "charge",
    amount,
    currency: "krw",
    refunded: false,
    status: "succeeded",
    created: now,
  });
  intents.set(piId, {
    id: piId,
    object: "payment_intent",
    amount,
    amount_received: amount,
    currency: "krw",
    status: "succeeded",
    latest_charge: chargeId,
    created: now,
    metadata,
    seq,
  });
  return { piId, chargeId, now };
}

function pay(session) {
  if (session.paymentIntent) return;
  const { piId } = createPaidIntent(session.amount, session.metadata);
  session.paymentIntent = piId;
  session.status = "complete";
}

async function sendCompleted(session) {
  const payload = JSON.stringify({
    id: `evt_sim_${session.id}`,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: { object: sessionView(session) },
  });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const res = await fetch(`${API}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": signature },
    body: payload,
  });
  console.log(`웹훅 checkout.session.completed ${session.id} → ${res.status}`);
}

function createRefund(form) {
  const intent = intents.get(form.get("payment_intent"));
  if (!intent) {
    return invalid(`No such payment_intent: '${form.get("payment_intent")}'`, "resource_missing");
  }
  const charge = charges.get(intent.latest_charge);
  if (charge?.refunded) {
    return invalid(`Charge ${charge.id} has already been refunded.`, "charge_already_refunded");
  }
  const done = [...refunds.values()]
    .filter((r) => r.payment_intent === intent.id)
    .reduce((s, r) => s + r.amount, 0);
  const amount = form.has("amount") ? Number(form.get("amount")) : intent.amount - done;
  if (!(amount > 0) || amount > intent.amount - done) {
    return invalid(
      `Refund amount (${amount}) is greater than unrefunded amount on charge (${intent.amount - done})`,
      "amount_too_large",
    );
  }
  if (charge && amount >= intent.amount - done) {
    charge.refunded = true;
  }
  const metadata = readMetadata(form);
  const id = `re_sim_${Date.now()}_${++seq}`;
  const refund = {
    id,
    object: "refund",
    amount,
    currency: "krw",
    status: "succeeded",
    payment_intent: intent.id,
    metadata,
    created: Math.floor(Date.now() / 1000),
    seq,
  };
  refunds.set(id, refund);
  return { status: 200, body: refund };
}

const page = (
  s,
) => `<!doctype html><html lang="ko"><meta charset="utf-8"><title>결제 시뮬레이터</title>
<body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem">
<h1 style="font-size:1.25rem">Hamkke 프리미엄 결제 시뮬레이터</h1>
<p>세션 ${s.id} · ${s.amount.toLocaleString("ko-KR")}원</p>
<form method="post" action="/c/pay/${s.id}/complete"><button>결제 완료</button></form>
<form method="post" action="/c/pay/${s.id}/cancel" style="margin-top:.5rem"><button>취소하고 돌아가기</button></form>
</body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Prices
  let m = url.pathname.match(/^\/v1\/prices\/([^/]+)$/);
  if (req.method === "GET" && m) {
    return json(res, 200, {
      id: m[1],
      object: "price",
      active: true,
      currency: "krw",
      unit_amount: 4900,
      recurring: { interval: "month", interval_count: 1 },
    });
  }

  // Customers
  if (req.method === "POST" && url.pathname === "/v1/customers") {
    const form = await readForm(req);
    const id = `cus_sim_${Date.now()}_${++seq}`;
    const customer = {
      id,
      object: "customer",
      email: form.get("email") ?? null,
      metadata: readMetadata(form),
      created: Math.floor(Date.now() / 1000),
      deleted: false,
    };
    customers.set(id, customer);
    return json(res, 200, customer);
  }
  m = url.pathname.match(/^\/v1\/customers\/([^/]+)$/);
  if (m && req.method === "GET") {
    const c = customers.get(m[1]);
    if (!c) {
      return json(res, 404, invalid(`No such customer: '${m[1]}'`, "resource_missing").body);
    }
    if (c.deleted) return json(res, 200, { id: c.id, object: "customer", deleted: true });
    return json(res, 200, c);
  }
  if (m && req.method === "DELETE") {
    const c = customers.get(m[1]) ?? { id: m[1], object: "customer" };
    c.deleted = true;
    customers.set(m[1], c);
    for (const sub of subscriptions.values()) {
      if (sub.customer === m[1]) sub.status = "canceled";
    }
    return json(res, 200, { id: m[1], object: "customer", deleted: true });
  }

  // Subscriptions
  if (req.method === "POST" && url.pathname === "/v1/subscriptions") {
    const form = await readForm(req);
    const metadata = readMetadata(form);
    const customer = form.get("customer");
    const priceId = form.get("items[0][price]") ?? "price_simulator_premium";
    const { piId, now } = createPaidIntent(4900, metadata);
    const invId = `in_sim_${Date.now()}_${++seq}`;
    invoices.set(invId, {
      id: invId,
      object: "invoice",
      customer,
      status: "paid",
      payment_intent: piId,
      created: now,
    });
    const id = `sub_sim_${Date.now()}_${++seq}`;
    const sub = {
      id,
      object: "subscription",
      customer,
      status: "active",
      metadata,
      latest_invoice: invId,
      created: now,
      items: {
        object: "list",
        data: [
          {
            id: `si_sim_${seq}`,
            object: "subscription_item",
            current_period_end: now + 30 * 86400,
            price: {
              id: priceId,
              object: "price",
              active: true,
              currency: "krw",
              recurring: { interval: "month", interval_count: 1 },
            },
          },
        ],
      },
    };
    subscriptions.set(id, sub);
    return json(res, 200, sub);
  }
  m = url.pathname.match(/^\/v1\/subscriptions\/([^/]+)$/);
  if (m && req.method === "GET") {
    const sub = subscriptions.get(m[1]);
    if (!sub) {
      return json(res, 404, invalid(`No such subscription: '${m[1]}'`, "resource_missing").body);
    }
    return json(res, 200, sub);
  }
  if (m && req.method === "DELETE") {
    const sub = subscriptions.get(m[1]);
    if (!sub) {
      return json(res, 404, invalid(`No such subscription: '${m[1]}'`, "resource_missing").body);
    }
    sub.status = "canceled";
    return json(res, 200, sub);
  }

  // Invoice payments (for duplicate subscription refund lookup)
  if (req.method === "GET" && url.pathname === "/v1/invoice_payments") {
    const invId = url.searchParams.get("invoice");
    const inv = invId ? invoices.get(invId) : null;
    const pi = inv ? intents.get(inv.payment_intent) : null;
    const data = pi
      ? [
          {
            id: `inpay_sim_${inv.id}`,
            object: "invoice_payment",
            invoice: inv.id,
            status: "paid",
            payment: {
              type: "payment_intent",
              payment_intent: {
                ...pi,
                latest_charge: charges.get(pi.latest_charge) ?? pi.latest_charge,
              },
            },
          },
        ]
      : [];
    return json(res, 200, {
      object: "list",
      url: "/v1/invoice_payments",
      has_more: false,
      data,
    });
  }

  // Checkout Sessions
  if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
    const form = await readForm(req);
    await sleep(LATENCY_MS);
    const id = `cs_test_sim_${Date.now()}_${++seq}`;
    const metadata = {
      ...readMetadata(form, "subscription_data[metadata]"),
      ...readMetadata(form, "metadata"),
    };
    const orderId = form.get("client_reference_id");
    if (orderId && !metadata.orderId) metadata.orderId = orderId;
    sessions.set(id, {
      id,
      mode: form.get("mode") ?? "subscription",
      status: "open",
      customer: form.get("customer"),
      orderId,
      amount: Number(form.get("line_items[0][price_data][unit_amount]") ?? 4900),
      successUrl: form.get("success_url"),
      cancelUrl: form.get("cancel_url"),
      metadata,
    });
    return json(res, 200, sessionView(sessions.get(id)));
  }
  if (req.method === "GET" && url.pathname === "/v1/checkout/sessions") {
    const customer = url.searchParams.get("customer");
    const status = url.searchParams.get("status");
    const rows = [...sessions.values()]
      .filter((s) => (!customer || s.customer === customer) && (!status || s.status === status))
      .map(sessionView);
    return json(res, 200, {
      object: "list",
      url: "/v1/checkout/sessions",
      has_more: false,
      data: rows,
    });
  }
  m = url.pathname.match(/^\/v1\/checkout\/sessions\/(\w+)\/expire$/);
  if (req.method === "POST" && m) {
    const s = sessions.get(m[1]);
    if (!s) {
      return json(
        res,
        404,
        invalid(`No such checkout.session: '${m[1]}'`, "resource_missing").body,
      );
    }
    s.status = "expired";
    return json(res, 200, sessionView(s));
  }
  m = url.pathname.match(/^\/v1\/checkout\/sessions\/(\w+)$/);
  if (req.method === "GET" && m) {
    calls.session++;
    const s = sessions.get(m[1]);
    return s
      ? json(res, 200, sessionView(s))
      : json(res, 404, invalid(`No such checkout.session: '${m[1]}'`, "resource_missing").body);
  }

  // Billing Portal Sessions
  if (req.method === "POST" && url.pathname === "/v1/billing_portal/sessions") {
    const form = await readForm(req);
    const id = `bps_sim_${Date.now()}_${++seq}`;
    return json(res, 200, {
      id,
      object: "billing_portal.session",
      customer: form.get("customer"),
      return_url: form.get("return_url"),
      url: `https://billing.stripe.com/p/session/${id}`,
    });
  }

  // PaymentIntents & Refunds
  m = url.pathname.match(/^\/v1\/payment_intents\/(\w+)$/);
  if (req.method === "GET" && m) {
    calls.fetch++;
    const pi = intents.get(m[1]);
    if (!pi) {
      return json(res, 404, invalid(`No such payment_intent: '${m[1]}'`, "resource_missing").body);
    }
    const { seq: _s, ...view } = pi;
    return json(res, 200, view);
  }
  if (req.method === "POST" && url.pathname === "/v1/refunds") {
    calls.refund++;
    const key = req.headers["idempotency-key"];
    if (key && idempotent.has(key)) {
      const saved = idempotent.get(key);
      return json(res, saved.status, saved.body);
    }
    const form = await readForm(req);
    const fault = takeFault("refund");
    const result =
      fault?.kind === "unavailable"
        ? {
            status: 503,
            body: { error: { type: "api_error", message: "시뮬레이터: 잠시 쓸 수 없음" } },
          }
        : createRefund(form);
    if (key && fault?.kind !== "unavailable") idempotent.set(key, result);
    if (fault?.kind === "timeout") await sleep(fault.delayMs ?? 5000);
    if (!res.destroyed) json(res, result.status, result.body);
    return;
  }

  // Simulator control endpoints
  if (req.method === "GET" && url.pathname === "/__sim/calls") return json(res, 200, calls);
  if (req.method === "POST" && url.pathname === "/__sim/reset") {
    customers.clear();
    subscriptions.clear();
    invoices.clear();
    charges.clear();
    sessions.clear();
    intents.clear();
    refunds.clear();
    idempotent.clear();
    faults = [];
    calls = { refund: 0, fetch: 0, session: 0, list: 0 };
    return json(res, 200, { ok: true });
  }

  // Hosted Checkout Simulator UI
  m = url.pathname.match(/^\/c\/pay\/(\w+)(?:\/(complete|cancel))?$/);
  const session = m && sessions.get(m[1]);
  if (!session) {
    return json(res, 404, {
      error: { message: `시뮬레이터에 없는 경로나 세션: ${url.pathname}` },
    });
  }
  if (req.method === "GET" && !m[2]) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(page(session));
  }
  if (req.method === "POST" && m[2] === "complete") {
    pay(session);
    const send = () =>
      sendCompleted(session).catch((err) => console.error(`웹훅 실패: ${err.message}`));
    if (WEBHOOK_DELAY_MS > 0) setTimeout(send, WEBHOOK_DELAY_MS);
    else await send();
  }
  res.writeHead(303, { Location: m[2] === "complete" ? session.successUrl : session.cancelUrl });
  res.end();
});

server.listen(PORT, () =>
  console.log(
    `Stripe 시뮬레이터 listening ${server.address().port} (API ${API}, 세션 지연 ${LATENCY_MS}ms, 웹훅 지연 ${WEBHOOK_DELAY_MS}ms)`,
  ),
);
