export const STATUS = {
  healthy: ["Healthy", "bg-emerald-50 text-emerald-700 ring-emerald-600/20"], degraded: ["Degraded", "bg-amber-50 text-amber-700 ring-amber-600/20"],
  critical: ["Critical", "bg-red-50 text-red-700 ring-red-600/20"], outage: ["Suspected outage", "bg-slate-800 text-white ring-slate-900/20"] };
export const Badge = ({ status }) => <span className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS[status][1]}`}>{STATUS[status][0]}</span>;
export const pct = (v) => (v == null ? "—" : v.toFixed(1) + "%");
export const when = (t) => (t ? new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) : "—");
export const relCls = (v) => (v == null ? "text-slate-400" : v < 50 ? "text-red-600" : v < 80 ? "text-amber-600" : "text-emerald-600");
export const Card = ({ title, right, children, className = "" }) => (
  <section className={`rounded-md border border-slate-200 bg-white shadow-sm ${className}`}>
    {title && <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5"><h3 className="text-sm font-semibold text-slate-700">{title}</h3>{right}</div>}
    <div className="p-4">{children}</div></section>);
export const Loading = () => <div className="p-10 text-center text-sm text-slate-500">Loading…</div>;
export const ErrorBox = ({ msg, retry }) => <div className="m-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">Something went wrong: {msg} {retry && <button onClick={retry} className="ml-2 underline">Retry</button>}</div>;
export const Empty = ({ children }) => <div className="p-8 text-center text-sm text-slate-500">{children}</div>;
export const Btn = ({ className = "", ...p }) => <button {...p} className={`rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 ${className}`} />;
export const inp = "rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none";
