import { useCallback, useEffect, useState } from "react";
async function call(method, url, body) {
  const r = await fetch("/api" + url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Request failed (${r.status})`);
  return r.json();
}
export const api = { get: (u) => call("GET", u), put: (u, b) => call("PUT", u, b), post: (u, b) => call("POST", u, b), patch: (u, b) => call("PATCH", u, b) };
export function useFetch(url, interval) {
  const [s, setS] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => api.get(url).then((data) => setS({ data, error: null, loading: false })).catch((e) => setS((p) => ({ ...p, error: e.message, loading: false }))), [url]);
  useEffect(() => { setS((p) => ({ ...p, loading: true })); load(); if (interval) { const t = setInterval(load, interval); return () => clearInterval(t); } }, [load, interval]);
  return { ...s, reload: load };
}
