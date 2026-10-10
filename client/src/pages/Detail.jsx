import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, useFetch } from "../api.js";
import { Badge, Btn, Card, Empty, ErrorBox, Loading, inp, pct, relCls, when } from "../ui.jsx";

const COLORS = ["#dc2626", "#f59e0b", "#6366f1", "#0ea5e9", "#64748b", "#a855f7"];
export default function Detail() {
  const { id } = useParams(), [sp] = useSearchParams(), since = sp.get("since");
  const { data: c, error, reload } = useFetch(`/chargers/${id}`);
  const [target, setTarget] = useState(""), [msg, setMsg] = useState("");
  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (!c) return <Loading />;
  const save = async () => { try { await api.put(`/chargers/${id}/sla-target`, { target: Number(target) }); setMsg("Saved"); reload(); } catch (e) { setMsg(e.message); } };
  const tipFmt = (v) => (v == null ? "no data" : v + "%");
  return (
    <div className="space-y-5">
      <div><Link to="/" className="text-xs text-slate-500 hover:underline">← Network overview</Link>
        <div className="mt-1 flex items-center gap-3"><h1 className="text-xl font-semibold">{c.name}</h1><Badge status={c.status} /></div>
        <p className="text-sm text-slate-500"><span className="num">{c.id}</span> · {c.area}, {c.city} · {c.connector} · {c.powerKw} kW</p></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Operator-claimed vs driver-verified">
          <div className="flex items-end justify-around text-center"><div><div className="num text-3xl font-semibold text-slate-500">{pct(c.claimedUptimePct)}</div><div className="text-xs text-slate-500">Operator claim ({c.claimedStatus})</div></div>
            <div><div className={`num text-3xl font-semibold ${relCls(c.reliability7d)}`}>{pct(c.reliability7d)}</div><div className="text-xs text-slate-500">Driver-verified (7d)</div></div></div>
          <div className={`mt-4 rounded px-3 py-2 text-sm ${c.divergence ? "bg-red-600 font-medium text-white" : "bg-slate-100 text-slate-600"}`}>
            {c.divergence ? `⚑ Divergence flag: gap of ${Math.abs(c.gap)} points exceeds the 20-point threshold` : `Gap of ${Math.abs(c.gap)} points — within tolerance`}</div>
          {c.suspectedOutage && <div className="mt-2 rounded bg-slate-800 px-3 py-2 text-sm text-white">Suspected outage: last two check-ins failed; none since {when(c.lastCheckin)}</div>}
        </Card>
        <Card title="SLA — current month">
          <div className="flex items-baseline gap-2"><span className={`num text-3xl font-semibold ${c.sla.met ? "text-emerald-600" : "text-red-600"}`}>{pct(c.sla.actual)}</span><span className="text-sm text-slate-500">vs target <span className="num">{c.sla.target}%</span></span></div>
          <div className="mt-1 text-sm text-slate-600"><span className="num font-semibold">{c.sla.breachDays}</span> of <span className="num">{c.sla.daysTracked}</span> days in breach · {c.sla.met ? "SLA met" : "SLA breached"}</div>
          <div className="mt-4 flex items-center gap-2"><input type="number" min="1" max="100" placeholder={String(c.sla.target)} className={`${inp} w-24`} value={target} onChange={(e) => setTarget(e.target.value)} /><Btn onClick={save} disabled={!target}>Set target %</Btn><span className="text-xs text-slate-500">{msg}</span></div>
        </Card>
        <Card title="Predicted reliability — next 6 hours" right={<span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">heuristic</span>}>
          <div className="h-36"><ResponsiveContainer><BarChart data={c.prediction.points}><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={30} /><Tooltip formatter={tipFmt} />
            <ReferenceLine y={c.slaTargetPct} stroke="#64748b" strokeDasharray="4 3" /><Bar dataKey="predicted" radius={[2, 2, 0, 0]}>{c.prediction.points.map((p, i) => <Cell key={i} fill={p.predicted < 50 ? "#dc2626" : p.predicted < c.slaTargetPct ? "#f59e0b" : "#10b981"} />)}</Bar></BarChart></ResponsiveContainer></div>
          <p className="mt-1 text-[11px] text-slate-500">{c.prediction.description}</p>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Verified reliability — last 7 days" className="lg:col-span-2"><div className="h-64"><ResponsiveContainer><LineChart data={c.trend7d}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={30} /><Tooltip formatter={tipFmt} />
          <ReferenceLine y={c.slaTargetPct} stroke="#64748b" strokeDasharray="4 3" label={{ value: `SLA ${c.slaTargetPct}%`, fontSize: 11, fill: "#64748b", position: "insideTopRight" }} />
          <ReferenceLine y={c.claimedUptimePct} stroke="#a855f7" strokeDasharray="2 3" label={{ value: "Claimed", fontSize: 11, fill: "#a855f7", position: "insideBottomRight" }} />
          <Line type="monotone" dataKey="reliability" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} connectNulls /></LineChart></ResponsiveContainer></div></Card>
        <Card title="Top failure reasons (7d)">{c.failureReasons.length ? <div className="h-64"><ResponsiveContainer><PieChart><Pie data={c.failureReasons} dataKey="count" nameKey="reason" innerRadius={50} outerRadius={80} paddingAngle={2}>{c.failureReasons.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div> : <Empty>No failures recorded.</Empty>}</Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Last 20 check-ins" className="lg:col-span-2">
          <ol className="relative ml-2 border-l border-slate-200">{c.recentCheckins.map((k) => (
            <li key={k.id} className={`mb-2.5 ml-4 text-sm ${since && k.t > since ? "rounded bg-emerald-50 px-2 py-1" : ""}`}>
              <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${k.ok ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className="num text-xs text-slate-500">{when(k.t)}</span> <span className={k.ok ? "font-medium text-emerald-700" : "font-medium text-red-700"}>{k.ok ? "Successful charge" : "Failed"}</span>
              <span className="text-slate-600">{k.ok ? ` · ${k.kwh} kWh` : ` · ${k.reason}`}</span>{since && k.t > since && <span className="ml-2 text-xs text-emerald-700">after resolution</span>}</li>))}</ol></Card>
        <Card title="Maintenance tickets">{c.tickets.length ? c.tickets.map((t) => (
          <Link key={t.id} to="/tickets" className="mb-2 block rounded border border-slate-200 p-2 text-sm hover:bg-slate-50"><div className="flex justify-between"><span className="num font-medium">{t.id}</span><span className="text-xs uppercase text-slate-500">{t.status.replace("_", " ")}</span></div><div className="text-xs text-slate-600">{t.title}</div></Link>)) : <Empty>No tickets for this charger.</Empty>}</Card>
      </div>
    </div>);
}
