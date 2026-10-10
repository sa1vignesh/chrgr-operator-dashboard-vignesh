import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Badge, Btn, inp, pct } from "../ui.jsx";

export default function Onboarding({ setOp }) {
  const [f, setF] = useState({ networkName: "", contactEmail: "", city: "Hyderabad" }), [res, setRes] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), nav = useNavigate();
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(""); try { setRes(await api.post("/onboarding", f)); } catch (x) { setErr(x.message); } setBusy(false); };
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 text-2xl font-bold">Chrgr<span className="text-emerald-500">.</span> <span className="text-sm font-normal text-slate-500">Operator onboarding</span></div>
      {!res ? <form onSubmit={submit} className="space-y-4 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Register your charging network</h1><p className="text-sm text-slate-500">We'll match your network to chargers already in the Chrgr driver check-in network and pre-populate your dashboard.</p>
        <label className="block text-sm font-medium">Network / company name<input required className={`${inp} mt-1 w-full`} value={f.networkName} onChange={(e) => setF({ ...f, networkName: e.target.value })} placeholder="e.g. Deccan Charge Networks Pvt Ltd" /></label>
        <label className="block text-sm font-medium">Contact email<input required type="email" className={`${inp} mt-1 w-full`} value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} /></label>
        <label className="block text-sm font-medium">Primary city<select className={`${inp} mt-1 w-full`} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}><option>Hyderabad</option><option>Warangal</option></select></label>
        {err && <p className="text-sm text-red-600">{err}</p>}<Btn disabled={busy}>{busy ? "Discovering chargers…" : "Register & discover chargers"}</Btn></form>
      : <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-lg font-semibold">✓ {res.chargers.length} chargers found for {res.operator.name}</h1><p className="mb-3 text-sm text-slate-500">These have been added to your dashboard.</p>
        <div className="max-h-72 overflow-y-auto rounded border border-slate-200"><table className="w-full text-sm"><tbody>{res.chargers.map((c) => <tr key={c.id} className="border-b border-slate-100"><td className="num px-3 py-1.5 text-xs text-slate-500">{c.id}</td><td className="px-3 py-1.5">{c.name}</td><td className="px-3 py-1.5 text-slate-500">{c.area}</td><td className="num px-3 py-1.5">{pct(c.reliability7d)}</td><td className="px-3 py-1.5"><Badge status={c.status} /></td></tr>)}</tbody></table></div>
        <Btn className="mt-4" onClick={() => { setOp(res.operator); nav("/"); }}>Go to dashboard →</Btn></div>}
    </div>);
}
