// Pure business logic. Check-ins are the single source of truth.
const fs = require("fs");
const path = require("path");
const H = 3600e3, D = 24 * H, IST = 5.5 * H;

const DEF = {
  CRITICAL_BELOW: 50,        // reliability % that is "critical"
  DIVERGENCE_GAP: 20,        // |claimed - verified| points
  OUTAGE_SILENCE_H: 6,       // last 2 check-ins failed AND no check-in for this long
};

function load() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "mock_chargers.json"), "utf8"));
  // Shift timestamps so the dataset always ends "now" (keeps rolling windows alive after redeploys).
  const shift = Date.now() - Date.parse(raw.generatedAt);
  raw.chargers.forEach((c) => c.checkins.forEach((k) => { k.ts = Date.parse(k.t) + shift; k.t = new Date(k.ts).toISOString(); }));
  return raw;
}

const rel = (l) => (l.length ? (100 * l.filter((k) => k.ok).length) / l.length : null);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const within = (c, ms, now) => c.checkins.filter((k) => k.ts <= now && now - k.ts <= ms);
const istDay = (ts) => new Date(ts + IST).toISOString().slice(0, 10);
const istHour = (ts) => new Date(ts + IST).getUTCHours();

function dailySeries(c, days, now) {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) buckets[istDay(now - i * D)] = [];
  c.checkins.forEach((k) => { const d = istDay(k.ts); if (buckets[d]) buckets[d].push(k); });
  return Object.entries(buckets).map(([date, l]) => ({ date, reliability: r1(rel(l)), checkins: l.length }));
}

function topFailures(c, days, now) {
  const m = {};
  within(c, days * D, now).filter((k) => !k.ok).forEach((k) => (m[k.reason] = (m[k.reason] || 0) + 1));
  return Object.entries(m).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

// Heuristic (not ML): same-hour success rate over last 7 days, nudged by 24h-vs-7d trend.
function predict(c, now) {
  const w = within(c, 7 * D, now), v7 = rel(w), v24 = rel(within(c, D, now)) ?? v7;
  const trend = ((v24 ?? 0) - (v7 ?? 0)) * 0.4;
  const out = [];
  for (let h = 1; h <= 6; h++) {
    const ts = now + h * H, hr = istHour(ts);
    const s = w.filter((k) => istHour(k.ts) === hr);
    // smoothing: pull small same-hour samples toward the 7-day average (k = 6 pseudo-observations)
    const base = s.length ? (s.filter((k) => k.ok).length + 6 * ((v7 ?? 0) / 100)) / (s.length + 6) * 100 : v7;
    let p = Math.max(0, Math.min(100, (base ?? 0) + trend));
    if (metrics(c, now).suspectedOutage) p = Math.min(p, 15);
    out.push({ label: String(hr).padStart(2, "0") + ":00", predicted: r1(p), basis: s.length >= 3 ? "same-hour history" : "7-day average" });
  }
  return { method: "heuristic", description: "Same hour-of-day success rate over the last 7 days, adjusted by the last-24h trend.", points: out };
}

function metrics(c, now) {
  const w7 = within(c, 7 * D, now), v7 = rel(w7), v24 = rel(within(c, D, now));
  const last = c.checkins.filter((k) => k.ts <= now).slice(-1)[0];
  const l2 = c.checkins.filter((k) => k.ts <= now).slice(-2);
  const suspectedOutage = !!last && l2.length === 2 && l2.every((k) => !k.ok) && now - last.ts >= DEF.OUTAGE_SILENCE_H * H && c.claimedStatus === "online";
  const gap = v7 == null ? 0 : r1(c.claimedUptimePct - v7);
  const divergence = Math.abs(gap) > DEF.DIVERGENCE_GAP;
  const critical = v7 != null && v7 < DEF.CRITICAL_BELOW;
  const status = suspectedOutage ? "outage" : critical ? "critical" : v7 < c.slaTargetPct ? "degraded" : "healthy";
  return { reliability7d: r1(v7), reliability24h: r1(v24), checkins7d: w7.length, lastCheckin: last?.t || null,
    lastSuccess: c.checkins.filter((k) => k.ok && k.ts <= now).slice(-1)[0]?.t || null,
    gap, divergence, critical, suspectedOutage, status };
}

// SLA: driver-verified reliability vs target over the current calendar month (IST).
function sla(c, now) {
  const month = istDay(now).slice(0, 7);
  const days = {};
  c.checkins.filter((k) => k.ts <= now && istDay(k.ts).startsWith(month)).forEach((k) => (days[istDay(k.ts)] ||= []).push(k));
  const daily = Object.entries(days).map(([date, l]) => ({ date, reliability: r1(rel(l)), checkins: l.length, breach: rel(l) < c.slaTargetPct }));
  const all = Object.values(days).flat(), actual = rel(all);
  const breachDays = daily.filter((d) => d.breach);
  return { month, target: c.slaTargetPct, actual: r1(actual), daysTracked: daily.length, breachDays: breachDays.length,
    met: actual != null && actual >= c.slaTargetPct, shortfall: actual == null ? null : r1(Math.max(0, c.slaTargetPct - actual)),
    worstDay: breachDays.length ? breachDays.reduce((a, b) => (a.reliability < b.reliability ? a : b)) : null, daily };
}

function summary(chargers, now) {
  const ms = chargers.map((c) => metrics(c, now));
  const all = chargers.flatMap((c) => within(c, 7 * D, now));
  return { totalChargers: chargers.length, overallReliability: r1(rel(all)), criticalCount: ms.filter((m) => m.critical).length,
    suspectedOutages: ms.filter((m) => m.suspectedOutage).length, divergenceCount: ms.filter((m) => m.divergence).length,
    slaBreaching: chargers.filter((c) => !sla(c, now).met).length, lastUpdated: new Date(now).toISOString() };
}

module.exports = { DEF, load, metrics, sla, predict, dailySeries, topFailures, summary, within, rel, r1 };
