const express = require("express");
const path = require("path");
const C = require("./compute");

const data = C.load();
const chargers = data.chargers;
const byId = (id) => chargers.find((c) => c.id === id);
let operator = { ...data.operator, onboarded: false };
let refreshedAt = Date.now();

const TECHS = ["Ravi Kumar", "Anitha Reddy", "Suresh Naidu", "Farhan Ali"];
const tickets = [], alerts = [];
const activeAlertKeys = new Set();
let tSeq = 1001, aSeq = 1;
let alertConfig = { reliabilityDropBelow: 60, divergence: true, suspectedOutage: true };

const view = (c, now = Date.now()) => ({ id: c.id, name: c.name, city: c.city, area: c.area, lat: c.lat, lng: c.lng, connector: c.connector,
  powerKw: c.powerKw, claimedStatus: c.claimedStatus, claimedUptimePct: c.claimedUptimePct, slaTargetPct: c.slaTargetPct, ...C.metrics(c, now) });

// Runs after every refresh: auto-creates tickets (<50% or divergence) and fires configurable alerts.
function evaluate(now = Date.now()) {
  const seen = new Set();
  for (const c of chargers) {
    const m = C.metrics(c, now);
    const hasOpen = tickets.some((t) => t.chargerId === c.id && t.status !== "resolved");
    if ((m.critical || m.divergence) && !hasOpen) {
      const reasons = [m.critical && `Reliability ${m.reliability7d}% is below ${C.DEF.CRITICAL_BELOW}%`,
        m.divergence && `Claimed ${c.claimedUptimePct}% vs verified ${m.reliability7d}% (gap ${Math.abs(m.gap)} pts)`].filter(Boolean);
      tickets.push({ id: `TKT-${tSeq++}`, chargerId: c.id, chargerName: c.name, trigger: m.critical ? "low_reliability" : "divergence",
        severity: m.critical ? "critical" : "high", title: reasons.join("; "), status: "open", assignee: null, notes: [],
        reliabilityAtCreation: m.reliability7d, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), resolvedAt: null });
    }
    const rules = [
      [`rel:${c.id}`, m.reliability7d != null && m.reliability7d < alertConfig.reliabilityDropBelow, "reliability_drop", m.critical ? "critical" : "warning", `${c.name}: reliability ${m.reliability7d}% (alert threshold ${alertConfig.reliabilityDropBelow}%)`],
      [`out:${c.id}`, alertConfig.suspectedOutage && m.suspectedOutage, "suspected_outage", "critical", `${c.name}: suspected outage — last 2 check-ins failed, no driver activity since ${m.lastCheckin?.slice(11, 16)} UTC`],
      [`div:${c.id}`, alertConfig.divergence && m.divergence, "divergence", "warning", `${c.name}: claimed ${c.claimedUptimePct}% vs driver-verified ${m.reliability7d}%`],
    ];
    for (const [key, on, type, severity, message] of rules) {
      if (!on) continue;
      seen.add(key);
      if (!activeAlertKeys.has(key)) { activeAlertKeys.add(key); alerts.unshift({ id: `ALT-${aSeq++}`, key, type, severity, chargerId: c.id, message, createdAt: new Date(now).toISOString(), read: false }); }
    }
  }
  for (const k of [...activeAlertKeys]) if (!seen.has(k)) activeAlertKeys.delete(k); // condition cleared -> can re-fire
  refreshedAt = now;
}
evaluate();
setInterval(() => evaluate(), 60_000);

const ticketView = (t) => {
  const c = byId(t.chargerId), now = Date.now();
  let recovery = null;
  if (t.resolvedAt) {
    const after = c.checkins.filter((k) => k.ts > Date.parse(t.resolvedAt));
    const r = C.rel(after);
    recovery = { checkinsSinceResolved: after.length, reliabilitySinceResolved: C.r1(r), before: t.reliabilityAtCreation,
      confirmed: after.length >= 3 && r >= c.slaTargetPct, link: `/chargers/${c.id}?since=${encodeURIComponent(t.resolvedAt)}` };
  }
  return { ...t, recovery, currentReliability: C.metrics(c, now).reliability7d };
};

const app = express();
app.use(express.json());
const api = express.Router();

api.get("/summary", (_q, r) => r.json({ ...C.summary(chargers, Date.now()), openTickets: tickets.filter((t) => t.status !== "resolved").length, unreadAlerts: alerts.filter((a) => !a.read).length, lastUpdated: new Date(refreshedAt).toISOString() }));
api.get("/chargers", (_q, r) => r.json(chargers.map((c) => view(c))));
api.get("/chargers/:id", (q, r) => {
  const c = byId(q.params.id); if (!c) return r.status(404).json({ error: "Charger not found" });
  const now = Date.now();
  r.json({ ...view(c, now), trend7d: C.dailySeries(c, 7, now), failureReasons: C.topFailures(c, 7, now),
    recentCheckins: c.checkins.slice(-20).reverse().map(({ id, t, ok, reason, kwh }) => ({ id, t, ok, reason, kwh })),
    prediction: C.predict(c, now), sla: C.sla(c, now), tickets: tickets.filter((t) => t.chargerId === c.id).map(ticketView) });
});
api.put("/chargers/:id/sla-target", (q, r) => {
  const c = byId(q.params.id), v = Number(q.body.target);
  if (!c) return r.status(404).json({ error: "Charger not found" });
  if (!(v >= 1 && v <= 100)) return r.status(400).json({ error: "Target must be between 1 and 100" });
  c.slaTargetPct = v; r.json(C.sla(c, Date.now()));
});

api.get("/sla", (_q, r) => r.json(chargers.map((c) => ({ id: c.id, name: c.name, city: c.city, area: c.area, ...C.sla(c, Date.now()), daily: undefined }))));
api.get("/sla/report.csv", (_q, r) => {
  const now = Date.now(), rows = [["Charger ID", "Name", "City", "Area", "Month", "Target %", "Actual %", "Days Tracked", "Days in Breach", "SLA Status", "Worst Day", "Worst Day %"]];
  chargers.forEach((c) => { const s = C.sla(c, now); rows.push([c.id, c.name, c.city, c.area, s.month, s.target, s.actual, s.daysTracked, s.breachDays, s.met ? "MET" : "BREACHED", s.worstDay?.date || "", s.worstDay?.reliability ?? ""]); });
  r.set({ "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="chrgr-sla-report-${C.sla(chargers[0], now).month}.csv"` });
  r.send(rows.map((x) => x.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"));
});

api.get("/tickets", (q, r) => r.json({ technicians: TECHS, tickets: tickets.filter((t) => !q.query.status || t.status === q.query.status).map(ticketView) }));
api.patch("/tickets/:id", (q, r) => {
  const t = tickets.find((x) => x.id === q.params.id); if (!t) return r.status(404).json({ error: "Ticket not found" });
  const { status, assignee } = q.body;
  if (status) { if (!["open", "in_progress", "resolved"].includes(status)) return r.status(400).json({ error: "Invalid status" }); t.status = status; t.resolvedAt = status === "resolved" ? new Date().toISOString() : null; }
  if (assignee !== undefined) { if (assignee && !TECHS.includes(assignee)) return r.status(400).json({ error: "Unknown technician" }); t.assignee = assignee || null; }
  t.updatedAt = new Date().toISOString(); r.json(ticketView(t));
});
api.post("/tickets/:id/notes", (q, r) => {
  const t = tickets.find((x) => x.id === q.params.id); if (!t) return r.status(404).json({ error: "Ticket not found" });
  if (!q.body.text?.trim()) return r.status(400).json({ error: "Note text required" });
  t.notes.push({ text: q.body.text.trim(), author: operator.name, at: new Date().toISOString() }); t.updatedAt = new Date().toISOString(); r.json(ticketView(t));
});

api.get("/alerts", (_q, r) => r.json({ config: alertConfig, alerts }));
api.put("/alert-config", (q, r) => {
  const { reliabilityDropBelow, divergence, suspectedOutage } = q.body;
  if (reliabilityDropBelow !== undefined && !(reliabilityDropBelow >= 1 && reliabilityDropBelow <= 100)) return r.status(400).json({ error: "Threshold must be 1–100" });
  alertConfig = { ...alertConfig, ...(reliabilityDropBelow !== undefined && { reliabilityDropBelow: Number(reliabilityDropBelow) }), ...(divergence !== undefined && { divergence: !!divergence }), ...(suspectedOutage !== undefined && { suspectedOutage: !!suspectedOutage }) };
  evaluate(); r.json({ config: alertConfig, alerts });
});
api.post("/alerts/read-all", (_q, r) => { alerts.forEach((a) => (a.read = true)); r.json({ ok: true }); });
api.patch("/alerts/:id/read", (q, r) => { const a = alerts.find((x) => x.id === q.params.id); if (!a) return r.status(404).json({ error: "Alert not found" }); a.read = true; r.json(a); });

api.get("/operator", (_q, r) => r.json(operator));
api.post("/onboarding", (q, r) => {
  const { networkName, contactEmail, city } = q.body;
  if (!networkName?.trim() || !/^\S+@\S+\.\S+$/.test(contactEmail || "")) return r.status(400).json({ error: "Network name and a valid email are required" });
  operator = { ...operator, name: networkName.trim(), contactEmail, city: city || "Hyderabad", onboarded: true };
  r.json({ operator, chargers: chargers.map((c) => view(c)) }); // "discovered" chargers pre-populate the dashboard
});
api.post("/refresh", (_q, r) => { evaluate(); r.json({ refreshedAt: new Date(refreshedAt).toISOString() }); });

app.use("/api", api);
app.use("/api", (_q, r) => r.status(404).json({ error: "Not found" }));
const dist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(dist));
app.get("*", (_q, r) => r.sendFile(path.join(dist, "index.html"), (e) => e && r.status(200).send("Chrgr API running. Build the client with `npm run build`.")));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Chrgr API on :${PORT} — ${tickets.length} auto-tickets, ${alerts.length} alerts`));
