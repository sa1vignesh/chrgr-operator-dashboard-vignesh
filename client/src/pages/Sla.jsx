import { useState } from "react";
import { Link } from "react-router-dom";
import { api, useFetch } from "../api.js";
import { Card, ErrorBox, Loading, inp, pct } from "../ui.jsx";

export default function Sla() {
  const { data, error, reload } = useFetch("/sla"), [err, setErr] = useState("");
  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (!data) return <Loading />;
  const setT = async (id, v) => { try { setErr(""); await api.put(`/chargers/${id}/sla-target`, { target: Number(v) }); reload(); } catch (e) { setErr(e.message); } };
  const breached = data.filter((d) => !d.met).length;
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between"><div><h1 className="text-xl font-semibold">SLA tracking — {data[0].month}</h1>
        <p className="text-sm text-slate-500"><span className="num">{breached}</span> of <span className="num">{data.length}</span> chargers are below their reliability target this month</p></div>
        <a href="/api/sla/report.csv" download className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">⬇ Download monthly SLA report (CSV)</a></div>
      {err && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <Card><div className="-m-4 overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-slate-50"><tr><th className="px-3 py-2">Charger</th><th className="px-3 py-2">Target %</th><th className="px-3 py-2">Actual (month)</th><th className="px-3 py-2 w-48">Progress to target</th><th className="px-3 py-2">Days in breach</th><th className="px-3 py-2">Worst day</th><th className="px-3 py-2">Status</th></tr></thead>
        <tbody>{[...data].sort((a, b) => (a.actual ?? 0) - (b.actual ?? 0)).map((d) => (
          <tr key={d.id} className="border-b border-slate-100"><td className="px-3 py-2"><Link to={`/chargers/${d.id}`} className="font-medium hover:underline">{d.name}</Link><div className="num text-xs text-slate-500">{d.id}</div></td>
            <td className="px-3 py-2"><input type="number" defaultValue={d.target} min="1" max="100" className={`${inp} num w-20`} onBlur={(e) => Number(e.target.value) !== d.target && setT(d.id, e.target.value)} /></td>
            <td className="num px-3 py-2 font-semibold">{pct(d.actual)}</td>
            <td className="px-3 py-2"><div className="h-2 rounded bg-slate-200"><div className={`h-2 rounded ${d.met ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, ((d.actual ?? 0) / d.target) * 100)}%` }} /></div></td>
            <td className="num px-3 py-2">{d.breachDays} / {d.daysTracked}</td><td className="num px-3 py-2 text-xs text-slate-600">{d.worstDay ? `${d.worstDay.date.slice(5)} · ${d.worstDay.reliability}%` : "—"}</td>
            <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${d.met ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{d.met ? "MET" : "BREACHED"}</span></td></tr>))}</tbody></table></div></Card>
    </div>);
}
