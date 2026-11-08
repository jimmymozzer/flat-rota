import { useEffect, useRef, useState, useCallback } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import type { Tick } from "./schedule";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export type SyncStatus = "needcode" | "checking" | "live" | "offline";
export type Config = { names: [string, string] };
const DEFAULT_NAMES: [string, string] = ["Jimmy", "Euan"];
const CODE_KEY = "flat-rota-code";
const POLL_MS = 15000;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function lsGet<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function lsSet(k: string, v: unknown) {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export type Custom = { id: string; week: string; name: string; owner: 0 | 1 | null; minutes: number };
type State = { names: [string, string]; ticks: Record<string, Tick>; custom: Custom[] };

async function fetchState(code: string): Promise<State> {
  const { data, error } = await sb.rpc("rota_state", { p_code: code });
  if (error) throw error;
  const names = Array.isArray(data?.names) && data.names.length === 2 ? (data.names as [string, string]) : DEFAULT_NAMES;
  const ticks: Record<string, Tick> = {};
  for (const [k, v] of Object.entries((data?.ticks || {}) as Record<string, any>)) {
    if (v && typeof v.by === "number") ticks[k] = { by: v.by, at: String(v.at || "") };
  }
  const custom: Custom[] = Array.isArray(data?.custom) ? (data.custom as any[])
    .filter((c) => c && typeof c.id === "string" && typeof c.name === "string")
    .map((c) => ({ id: c.id, week: String(c.week), name: c.name, owner: c.owner === 0 || c.owner === 1 ? c.owner : null, minutes: Number(c.minutes) || 15 }))
    : [];
  return { names, ticks, custom };
}

const isBadCode = (e: any) => String(e?.message || "").includes("wrong flat code");

export function useRotaStore() {
  const [code, setCode] = useState<string | null>(() => lsGet<string | null>(CODE_KEY, null));
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [config, setConfig] = useState<Config>({ names: DEFAULT_NAMES });
  const [custom, setCustom] = useState<Custom[]>([]);
  const [status, setStatus] = useState<SyncStatus>(code ? "checking" : "needcode");
  const [codeError, setCodeError] = useState<string | null>(null);
  const chan = useRef<RealtimeChannel | null>(null);
  const pending = useRef(0);

  const refresh = useCallback(async (c: string) => {
    try {
      const s = await fetchState(c);
      if (pending.current === 0) { setTicks(s.ticks); setConfig({ names: s.names }); setCustom(s.custom); }
      setStatus("live");
      return true;
    } catch (e) {
      if (isBadCode(e)) {
        lsSet(CODE_KEY, null); setCode(null); setStatus("needcode");
        setCodeError("That flat code didn't match.");
      } else setStatus("offline");
      return false;
    }
  }, []);

  // Load, live updates via a broadcast channel, polling as a fallback.
  useEffect(() => {
    if (!code) return;
    let stopped = false;
    refresh(code);
    let channel: RealtimeChannel | null = null;
    sha256(code).then((h) => {
      if (stopped) return;
      channel = sb.channel("rota-" + h);
      channel.on("broadcast", { event: "changed" }, () => refresh(code)).subscribe();
      chan.current = channel;
    });
    const poll = setInterval(() => { if (document.visibilityState === "visible") refresh(code); }, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") refresh(code); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      stopped = true; clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      if (channel) sb.removeChannel(channel);
      chan.current = null;
    };
  }, [code, refresh]);

  const notify = () => { chan.current?.send({ type: "broadcast", event: "changed", payload: {} }); };

  const submitCode = useCallback(async (c: string) => {
    const trimmed = c.trim();
    if (!trimmed) return;
    setCodeError(null);
    try {
      await fetchState(trimmed);
      lsSet(CODE_KEY, trimmed); setCode(trimmed); setStatus("checking");
    } catch (e) {
      setStatus("needcode");
      setCodeError(isBadCode(e) ? "That flat code didn't match." : "Couldn't reach the rota. Check your connection and try again.");
    }
  }, []);

  const forget = useCallback(() => { lsSet(CODE_KEY, null); setCode(null); setStatus("needcode"); }, []);

  const setTick = useCallback(async (key: string, tick: Tick | null) => {
    if (!code) return;
    setTicks((prev) => { const n = { ...prev }; if (tick) n[key] = tick; else delete n[key]; return n; });
    pending.current++;
    const { error } = await sb.rpc("rota_tick", { p_code: code, p_key: key, p_by: tick ? tick.by : null });
    pending.current--;
    if (error) { setStatus("offline"); }
    else notify();
    refresh(code);
  }, [code, refresh]);

  const saveConfig = useCallback(async (c: Config) => {
    if (!code) return;
    setConfig(c);
    const { error } = await sb.rpc("rota_names", { p_code: code, p_names: c.names });
    if (error) setStatus("offline"); else notify();
    refresh(code);
  }, [code, refresh]);

  // Returns an error message, or null on success.
  const saveCustom = useCallback(async (c: Custom): Promise<string | null> => {
    if (!code) return "Not connected";
    setCustom((prev) => [...prev.filter((x) => x.id !== c.id), c]);
    const { error } = await sb.rpc("rota_custom_save", { p_code: code, p_id: c.id, p_week: c.week, p_name: c.name, p_owner: c.owner, p_minutes: c.minutes });
    if (!error) notify();
    refresh(code);
    if (!error) return null;
    return /rota_custom_save|function|schema cache/i.test(error.message || "")
      ? "The database needs the one-off jobs update first (the SQL Claude sent)."
      : "Couldn't save the job. Check your connection and try again.";
  }, [code, refresh]);

  const deleteCustom = useCallback(async (id: string) => {
    if (!code) return;
    setCustom((prev) => prev.filter((x) => x.id !== id));
    const { error } = await sb.rpc("rota_custom_delete", { p_code: code, p_id: id });
    if (!error) notify();
    refresh(code);
  }, [code, refresh]);

  return { ticks, config, status, setTick, saveConfig, submitCode, codeError, forget, custom, saveCustom, deleteCustom };
}

export function useMe(): [0 | 1 | null, (v: 0 | 1 | null) => void] {
  const [me, setMeState] = useState<0 | 1 | null>(() => lsGet<0 | 1 | null>("flat-rota-me", null));
  const setMe = (v: 0 | 1 | null) => { setMeState(v); lsSet("flat-rota-me", v); };
  return [me, setMe];
}
