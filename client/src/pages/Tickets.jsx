import { useState } from "react";
import { Link } from "react-router-dom";
import { api, useFetch } from "../api.js";
import { Btn, Card, Empty, ErrorBox, Loading, inp, when } from "../ui.jsx";

const SEV = { critical: "bg-red-50 text-red-700", high: "bg-amber-50 text-amber-700" };
function Ticket({ t, techs, onChange }) {
  const [note, setNote] = useState(""), [err, setErr] = useState("");
  const run = async (fn) => { try { setErr(""); await fn(); onChange(); } catch (e) { setErr(e.message); } };
  return (
    <Card className="mb-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><span className="num font-semibold">{t.id}</span><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEV[t.severity]}`}>{t.severity}</span><span className="text-xs text-slate-500">opened {when(t.createdAt)}</span></div>
          <Link to={`/chargers/${t.chargerId}`} className="mt-1 block text-sm font-medium hover:underline">{t.chargerName} <span className="num text-xs text-slate-500">{t.chargerId}</span></Link><p className="text-sm text-slate-600">{t.title}</p></div>
        <div className="flex gap-2">
          <select className={inp} value={t.assignee || ""} onChange={(e) => run(() => api.patch(`/tickets/${t.id}`, { assignee: e.target.value }))}><option value="">Unassigned</option>{techs.map((x) => <option key={x}>{x}</option>)}</select>
          <select className={inp} value={t.status} onChange={(e) => run(() => api.patch(`/tickets/${t.id}`, { status: e.target.value }))}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div></div>
      {t.recovery && <div className={`mt-3 rounded px-3 py-2 text-sm ${t.recovery.confirmed ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
        {t.recovery.confirmed ? "✓ Recovery confirmed" : "Awaiting recovery confirmation"}: <span className="num">{t.recovery.checkinsSinceResolved}</span> driver check-ins since resolution{t.recovery.checkinsSinceResolved ? <>, <span className="num">{t.recovery.reliabilitySinceResolved}%</span> successful</> : ""} (was <span className="num">{t.recovery.before}%</span>). <Link className="underline" to={t.recovery.link}>View check-in history</Link></div>}
      {t.notes.length > 0 && <ul className="mt-3 space-y-1 text-sm">{t.notes.map((n, i) => <li key={i} className="rounded bg-slate-50 px-2 py-1"><span className="num text-xs text-slate-500">{when(n.at)}</span> · {n.text}</li>)}</ul>}
      <div className="mt-3 flex gap-2"><input className={`${inp} flex-1`} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
        <Btn disabled={!note.trim()} onClick={() => run(async () => { await api.post(`/tickets/${t.id}/notes`, { text: note }); setNote(""); })}>Add note</Btn></div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </Card>);
}
export default function Tickets() {
  const { data, error, reload } = useFetch("/tickets"), [f, setF] = useState("active");
  if (error) return <ErrorBox msg={error} retry={reload} />;
  if (!data) return <Loading />;
  const list = data.tickets.filter((t) => (f === "active" ? t.status !== "resolved" : f === "resolved" ? t.status === "resolved" : true));
  return (
    <div><div className="mb-4 flex items-end justify-between"><div><h1 className="text-xl font-semibold">Maintenance tickets</h1><p className="text-sm text-slate-500">Auto-created when reliability drops below 50% or the divergence flag fires</p></div>
      <div className="flex gap-1">{[["active", "Active"], ["resolved", "Resolved"], ["all", "All"]].map(([k, l]) => <button key={k} onClick={() => setF(k)} className={`rounded px-3 py-1.5 text-sm ${f === k ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{l}</button>)}</div></div>
      {list.length ? list.map((t) => <Ticket key={t.id} t={t} techs={data.technicians} onChange={reload} />) : <Card><Empty>No tickets in this view.</Empty></Card>}</div>);
}
