import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../api.js";
import { Badge, Card, Empty, ErrorBox, Loading, inp, pct, relCls, when } from "../ui.jsx";

const Stat = ({ label, value, sub, cls = "" }) => (
  <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className={`num mt-1 text-2xl font-semibold ${cls}`}>{value}</div><div className="mt-0.5 text-xs text-slate-500">{sub}</div></div>);

export default function Dashboard() {
  const sum = useFetch("/summary", 30000), list = useFetch("/chargers", 30000), nav = useNavigate();
  const [q, setQ] = useState(""), [city, setCity] = useState(""), [st, setSt] = useState(""), [sort, setSort] = useState({ k: "reliability7d", d: 1 });
  const rows = useMemo(() => (list.data || []).filter((c) => (!city || c.city === city) && (!st || c.status === st) && (c.name + c.area + c.id).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => ((a[sort.k] ?? -1) > (b[sort.k] ?? -1) ? 1 : -1) * sort.d), [list.data, q, city, st, sort]);
  if (sum.error || list.error) return <ErrorBox msg={sum.error || list.error} retry={() => { sum.reload(); list.reload(); }} />;
  if (!sum.data || !list.data) return <Loading />;
  const s = sum.data, H = ({ k, children }) => <th className="cursor-pointer select-none px-3 py-2" onClick={() => setSort({ k, d: sort.k === k ? -sort.d : 1 })}>{children}{sort.k === k ? (sort.d > 0 ? " ▲" : " ▼") : ""}</th>;
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between"><div><h1 className="text-xl font-semibold">Network overview</h1><p className="text-sm text-slate-500">Driver-verified reliability across your charging network (rolling 7 days)</p></div>
        <div className="text-xs text-slate-500">Last updated <span className="num">{when(s.lastUpdated)}</span> IST</div></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Total chargers" value={s.totalChargers} sub={`${s.openTickets} open tickets`} />
        <Stat label="Verified reliability" value={pct(s.overallReliability)} cls={relCls(s.overallReliability)} sub="Successful check-ins ÷ all" />
        <Stat label="Critical (<50%)" value={s.criticalCount} cls={s.criticalCount ? "text-red-600" : ""} sub={`${s.divergenceCount} claim/verify divergences`} />
        <Stat label="Suspected outages" value={s.suspectedOutages} cls={s.suspectedOutages ? "text-red-600" : ""} sub="Online claim, failed check-ins" />
        <Stat label="Last updated" value={when(s.lastUpdated).slice(-5)} sub={`${s.slaBreaching} chargers breaching SLA`} />
      </div>
      <Card title={`Chargers (${rows.length})`} right={<div className="flex gap-2">
        <input className={inp} placeholder="Search name, area, ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inp} value={city} onChange={(e) => setCity(e.target.value)}><option value="">All cities</option><option>Hyderabad</option><option>Warangal</option></select>
        <select className={inp} value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option><option value="healthy">Healthy</option><option value="degraded">Degraded</option><option value="critical">Critical</option><option value="outage">Suspected outage</option></select></div>}>
        {!rows.length ? <Empty>No chargers match these filters.</Empty> : <div className="-m-4 overflow-x-auto"><table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50"><tr><H k="id">ID</H><H k="name">Charger</H><H k="area">Location</H><H k="connector">Connector</H><H k="claimedUptimePct">Claimed</H><H k="reliability7d">Verified</H><H k="gap">Gap</H><H k="slaTargetPct">SLA</H><H k="status">Status</H><H k="lastCheckin">Last check-in</H></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id} onClick={() => nav(`/chargers/${c.id}`)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
              <td className="num px-3 py-2 text-xs text-slate-500">{c.id}</td><td className="px-3 py-2 font-medium">{c.name}</td>
              <td className="px-3 py-2 text-slate-600">{c.area}, {c.city}</td><td className="px-3 py-2 text-slate-600">{c.connector} · {c.powerKw}kW</td>
              <td className="num px-3 py-2">{pct(c.claimedUptimePct)}</td><td className={`num px-3 py-2 font-semibold ${relCls(c.reliability7d)}`}>{pct(c.reliability7d)}</td>
              <td className="px-3 py-2">{c.divergence ? <span className="num rounded bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">⚑ {Math.abs(c.gap).toFixed(0)} pts</span> : <span className="num text-slate-400">{c.gap.toFixed(0)}</span>}</td>
              <td className="num px-3 py-2 text-slate-600">{c.slaTargetPct}%</td><td className="px-3 py-2"><Badge status={c.status} /></td><td className="num px-3 py-2 text-xs text-slate-500">{when(c.lastCheckin)}</td></tr>))}</tbody></table></div>}
      </Card>
    </div>);
}
