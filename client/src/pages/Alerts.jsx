import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, useFetch } from "../api.js";
import { Btn, Card, Empty, ErrorBox, Loading, inp, when } from "../ui.jsx";

const ICON = { reliability_drop: "📉", suspected_outage: "⛔", divergence: "⚑" };
export default function Alerts() {
  const { data, error, reload } = useFetch("/alerts"), [cfg, setCfg] = useState(null), [msg, setMsg] = useState("");
  useEffect(() => { if (data) setCfg(data.config); }, [data]);
  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (!data || !cfg) return <Loading />;
  const save = async () => { try { await api.put("/alert-config", cfg); setMsg("Alert rules saved"); reload(); } catch (e) { setMsg(e.message); } };
  const unread = data.alerts.filter((a) => !a.read).length;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2"><div className="mb-4 flex items-end justify-between"><div><h1 className="text-xl font-semibold">Notification centre</h1><p className="text-sm text-slate-500"><span className="num">{unread}</span> unread of <span className="num">{data.alerts.length}</span></p></div>
        <Btn disabled={!unread} onClick={async () => { await api.post("/alerts/read-all"); reload(); }}>Mark all read</Btn></div>
        <Card>{data.alerts.length ? <ul className="-m-4 divide-y divide-slate-100">{data.alerts.map((a) => (
          <li key={a.id} className={`flex items-start gap-3 px-4 py-3 ${a.read ? "opacity-60" : "bg-slate-50"}`}><span>{ICON[a.type]}</span>
            <div className="flex-1 text-sm"><div className={a.severity === "critical" ? "font-medium text-red-700" : "font-medium"}>{a.message}</div><div className="mt-0.5 text-xs text-slate-500"><span className="num">{when(a.createdAt)}</span> · <Link className="underline" to={`/chargers/${a.chargerId}`}>View charger</Link></div></div>
            {!a.read && <button className="text-xs text-slate-600 underline" onClick={async () => { await api.patch(`/alerts/${a.id}/read`); reload(); }}>Mark read</button>}</li>))}</ul> : <Empty>No alerts — all chargers are within your thresholds.</Empty>}</Card></div>
      <Card title="Alert rules">
        <label className="block text-sm">Alert when reliability drops below<div className="mt-1 flex items-center gap-2"><input type="number" min="1" max="100" className={`${inp} num w-20`} value={cfg.reliabilityDropBelow} onChange={(e) => setCfg({ ...cfg, reliabilityDropBelow: e.target.value })} />%</div></label>
        {[["suspectedOutage", "Suspected outages"], ["divergence", "Claimed-vs-verified divergence"]].map(([k, l]) => <label key={k} className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} />{l}</label>)}
        <Btn className="mt-4" onClick={save}>Save rules</Btn><p className="mt-2 text-xs text-slate-500">{msg}</p></Card>
    </div>);
}
