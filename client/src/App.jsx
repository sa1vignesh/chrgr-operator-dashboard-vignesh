import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, Route, Routes, Link } from "react-router-dom";
import { api, useFetch } from "./api.js";
import { Loading, ErrorBox } from "./ui.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Detail from "./pages/Detail.jsx";
import Sla from "./pages/Sla.jsx";
import Tickets from "./pages/Tickets.jsx";
import Alerts from "./pages/Alerts.jsx";
import Onboarding from "./pages/Onboarding.jsx";

function Shell({ op }) {
  const { data: s } = useFetch("/summary", 30000);
  const nav = [["/", "Dashboard"], ["/sla", "SLA Tracking"], ["/tickets", "Maintenance", s?.openTickets], ["/alerts", "Alerts", s?.unreadAlerts]];
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-slate-900 text-slate-300">
        <div className="px-5 py-5 text-lg font-bold tracking-tight text-white">Chrgr<span className="text-emerald-400">.</span><div className="text-[10px] font-normal uppercase tracking-widest text-slate-400">Operator Intelligence</div></div>
        <nav className="space-y-0.5 px-2">{nav.map(([to, label, n]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex items-center justify-between rounded px-3 py-2 text-sm ${isActive ? "bg-slate-800 text-white" : "hover:bg-slate-800/60"}`}>
            {label}{n > 0 && <span className="num rounded-full bg-red-500 px-1.5 text-[11px] text-white">{n}</span>}</NavLink>))}</nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-sm font-medium text-slate-700">{op.name}</div>
          <Link to="/alerts" className="relative text-sm text-slate-600 hover:text-slate-900">🔔 Notifications{s?.unreadAlerts > 0 && <span className="num ml-1.5 rounded-full bg-red-500 px-1.5 text-[11px] text-white">{s.unreadAlerts}</span>}</Link>
        </header>
        <main className="flex-1 p-6"><Outlet /></main>
      </div>
    </div>);
}

export default function App() {
  const [op, setOp] = useState(null), [err, setErr] = useState(null);
  useEffect(() => { api.get("/operator").then(setOp).catch((e) => setErr(e.message)); }, []);
  if (err) return <ErrorBox msg={err} retry={() => location.reload()} />;
  if (!op) return <Loading />;
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding setOp={setOp} />} />
      <Route element={op.onboarded ? <Shell op={op} /> : <Navigate to="/onboarding" replace />}>
        <Route index element={<Dashboard />} /><Route path="chargers/:id" element={<Detail />} />
        <Route path="sla" element={<Sla />} /><Route path="tickets" element={<Tickets />} /><Route path="alerts" element={<Alerts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>);
}
