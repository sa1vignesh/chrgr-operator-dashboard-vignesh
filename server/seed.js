// Generates mock_chargers.json: 20 chargers (Hyderabad + Warangal) with 30 days of driver check-ins.
// Check-ins are the single source of truth; reliability, SLA, tickets and predictions derive from them.
const fs = require("fs");
const path = require("path");

let s = 20261010; // seeded PRNG -> reproducible data
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const wpick = (w) => { const r = rnd() * Object.values(w).reduce((a, b) => a + b, 0); let c = 0;
  for (const [k, v] of Object.entries(w)) { c += v; if (r <= c) return k; } };

const DAYS = 30, NOW = Date.now(), H = 3600e3;
const OPERATOR = { id: "op_deccan", name: "Deccan Charge Networks Pvt Ltd" };

// id, name, city, area, lat, lng, connector, kW, profile, claimedUptime%, outageHoursAgo
const C = [
  ["CHG-HYD-001","Financial District Plaza","Hyderabad","Gachibowli",17.4156,78.3489,"CCS2",60,"healthy",95],
  ["CHG-HYD-002","Cyber Towers Basement","Hyderabad","HITEC City",17.4504,78.3814,"CCS2",120,"healthy",96],
  ["CHG-HYD-003","Road No. 12 Mall Parking","Hyderabad","Banjara Hills",17.4126,78.4375,"Type 2",22,"ok",78],
  ["CHG-HYD-004","KPHB Phase 4 Metro","Hyderabad","Kukatpally",17.4948,78.3996,"Bharat DC001",15,"healthy",93],
  ["CHG-HYD-005","Inorbit Mall Level P2","Hyderabad","Madhapur",17.4344,78.3872,"CCS2",60,"ok",84],
  ["CHG-HYD-006","Jubilee Check Post","Hyderabad","Jubilee Hills",17.4326,78.4071,"CHAdeMO",50,"critical",58],
  ["CHG-HYD-007","Paradise Circle","Hyderabad","Secunderabad",17.4416,78.4983,"CCS2",30,"divergent",98],
  ["CHG-HYD-008","Airport Road Fuel Hub","Hyderabad","Begumpet",17.4435,78.4676,"CCS2",60,"degraded",70],
  ["CHG-HYD-009","Kondapur Botanical Garden","Hyderabad","Kondapur",17.4592,78.3646,"Type 2",22,"outage",80,14],
  ["CHG-HYD-010","Miyapur Metro Station","Hyderabad","Miyapur",17.4968,78.3614,"Bharat DC001",15,"healthy",88],
  ["CHG-HYD-011","Shamshabad Airport P3","Hyderabad","Shamshabad",17.2403,78.4294,"CCS2",120,"ok",86],
  ["CHG-HYD-012","Uppal Ring Road","Hyderabad","Uppal",17.4058,78.5591,"CHAdeMO",50,"divergent",97],
  ["CHG-HYD-013","LB Nagar Junction","Hyderabad","LB Nagar",17.3457,78.5522,"Type 2",22,"critical",50],
  ["CHG-HYD-014","Manikonda Lanco Hills","Hyderabad","Manikonda",17.4018,78.3797,"CCS2",60,"divergent",98],
  ["CHG-HYD-015","Wipro Circle","Hyderabad","Nanakramguda",17.4167,78.3436,"CCS2",60,"outage",82,9],
  ["CHG-HYD-016","Ameerpet Metro Hub","Hyderabad","Ameerpet",17.4375,78.4483,"Bharat DC001",15,"ok",87],
  ["CHG-WGL-017","Kakatiya University Gate","Warangal","Hanamkonda",18.0069,79.5586,"CCS2",30,"healthy",96],
  ["CHG-WGL-018","Fort Road Parking","Warangal","Warangal Fort",17.9468,79.6003,"Type 2",22,"ok",93],
  ["CHG-WGL-019","Subedari NH-163","Warangal","Subedari",17.9786,79.5941,"CHAdeMO",50,"outage",82,20],
  ["CHG-WGL-020","Kazipet Railway Junction","Warangal","Kazipet",17.9733,79.5113,"CCS2",30,"divergent",97],
];

const REASONS = ["Charger offline","Connector fault","Payment failed","Session interrupted","Cable damaged","Bay blocked"];
const reasonW = (p) => p === "critical" ? { "Connector fault":5,"Charger offline":4,"Session interrupted":2,"Payment failed":1,"Cable damaged":1,"Bay blocked":0.5 }
  : p === "outage" ? { "Charger offline":8,"Connector fault":1,"Payment failed":1 }
  : { "Payment failed":3,"Session interrupted":3,"Bay blocked":2,"Connector fault":2,"Charger offline":1.5,"Cable damaged":0.5 };

function rate(profile, d, hour) {
  let r = { healthy:.92, ok:.84, critical:.33, divergent:.56, degraded: d < 7 ? .36 + .04 * d : .88, outage:.86 }[profile];
  if (hour >= 18 && hour <= 21) r -= .07;   // evening peak = more contention/failures
  return Math.max(.05, Math.min(.99, r + (rnd() - .5) * .08));
}

const chargers = C.map(([id,name,city,area,lat,lng,connector,powerKw,profile,claimed,outH]) => {
  const checkins = [];
  const perDay = city === "Warangal" ? 4 : 7;
  const cutoff = outH ? NOW - outH * H : null;
  for (let d = DAYS - 1; d >= 0; d--) {
    const n = Math.max(2, Math.round(perDay + (rnd() - .5) * 4));
    for (let i = 0; i < n; i++) {
      const hour = Math.min(23, Math.max(6, Math.round(14 + (rnd() + rnd() + rnd() - 1.5) * 9)));
      const t = new Date(NOW - d * 24 * H); t.setHours(hour, Math.floor(rnd() * 60), 0, 0);
      if (t.getTime() > NOW || (cutoff && t.getTime() > cutoff)) continue;
      const ok = rnd() < rate(profile, d, hour);
      checkins.push({ t: t.toISOString(), ok, reason: ok ? null : wpick(reasonW(profile)),
        connector, kwh: ok ? +(8 + rnd() * 30).toFixed(1) : null });
    }
  }
  checkins.sort((a, b) => a.t.localeCompare(b.t));
  if (cutoff) for (let k = 1; k <= 2; k++) { const c = checkins[checkins.length - k]; c.ok = false; c.reason = "Charger offline"; c.kwh = null; }
  checkins.forEach((c, i) => (c.id = `${id}-${i + 1}`));
  return { id, name, operatorId: OPERATOR.id, city, area, lat, lng, connector, powerKw,
    claimedStatus: "online", claimedUptimePct: claimed, slaTargetPct: 80, checkins };
});

const out = { generatedAt: new Date(NOW).toISOString(), operator: OPERATOR, chargers };
fs.writeFileSync(path.join(__dirname, "mock_chargers.json"), JSON.stringify(out));
fs.writeFileSync(path.join(__dirname, "..", "mock_chargers.json"), JSON.stringify(out, null, 1));

// sanity summary
for (const c of chargers) {
  const w = c.checkins.filter(x => NOW - new Date(x.t) < 7 * 24 * H);
  const rel = Math.round(100 * w.filter(x => x.ok).length / w.length);
  const last = c.checkins.filter(x => x.ok).pop();
  const gap = Math.round((NOW - new Date(last.t)) / H);
  console.log(c.id.padEnd(12), String(c.checkins.length).padStart(4), "chk", `7d=${rel}%`.padEnd(7),
    `claimed=${c.claimedUptimePct}%`, Math.abs(c.claimedUptimePct - rel) > 20 ? "DIVERGE" : "", rel < 50 ? "CRITICAL" : "", gap > 8 ? `lastOK=${gap}h` : "");
}
