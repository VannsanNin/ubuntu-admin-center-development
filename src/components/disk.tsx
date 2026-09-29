import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  HardDrive,
  Folder,
  File,
  Search,
} from "lucide-react";
import { ActionButton } from "./shared";

/* ================= DISK ANALYZER MODULE ================= */

const TABS = [
  { id: "drives", label: "Drives", icon: HardDrive },
  { id: "folders", label: "Largest folders", icon: Folder },
  { id: "files", label: "Largest files", icon: File },
] as const;

type Tab = (typeof TABS)[number]["id"];

function usageColor(pct: number) {
  if (pct > 90) return { bar: "bg-red-500", text: "text-red-400", chip: "bg-red-500/10 border-red-500/20" };
  if (pct > 70) return { bar: "bg-amber-500", text: "text-amber-400", chip: "bg-amber-500/10 border-amber-500/20" };
  return { bar: "bg-emerald-500", text: "text-emerald-400", chip: "bg-emerald-500/10 border-emerald-500/20" };
}

export function DiskModule() {
  const [drives, setDrives] = useState<any[]>([]);
  const [path, setPath] = useState("/");
  const [largest, setLargest] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("drives");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/system/disk");
      setDrives(res.data.drives || []);
    } catch {
      setError("Couldn't load drive information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrives();
  }, [fetchDrives]);

  const fetchLargest = async (action: "largestFolders" | "largestFiles") => {
    setTab(action === "largestFolders" ? "folders" : "files");
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/system/disk?action=${action}&path=${encodeURIComponent(path)}`);
      setLargest(res.data.items || []);
    } catch {
      setError(`Couldn't scan ${path}.`);
    } finally {
      setLoading(false);
    }
  };

  const runScan = () => {
    if (tab === "drives") return fetchDrives();
    fetchLargest(tab === "folders" ? "largestFolders" : "largestFiles");
  };

  return (
    <div className="space-y-5 text-slate-100 max-w-6xl mx-auto font-[DM_Sans,sans-serif]">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-[11px] font-mono mb-1">
            <span>system</span>
            <span>/</span>
            <span className="text-sky-400">disk</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Disk &amp; volume analyzer</h2>
          <p className="text-sm text-slate-500 mt-1">Check space on each drive, then drill into what's using it.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => (id === "drives" ? (setTab("drives"), fetchDrives()) : fetchLargest(id === "folders" ? "largestFolders" : "largestFiles"))}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-sm transition ${
              tab === id ? "text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {tab === id && <span className="absolute -bottom-px left-0 right-0 h-px bg-sky-400" />}
          </button>
        ))}
      </div>

      {/* Path input — only relevant once you're scanning a location */}
      {tab !== "drives" && (
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runScan()}
              placeholder="/home, /var/log …"
              className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 rounded-md text-sm font-mono transition outline-none placeholder:text-slate-700"
            />
          </div>
          <ActionButton onClick={runScan}>Scan</ActionButton>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Drives */}
      {tab === "drives" ? (
        <div className="border border-slate-800 rounded-md overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Filesystem</th>
                <th className="px-4 py-2.5 font-medium w-20">Size</th>
                <th className="px-4 py-2.5 font-medium w-20">Used</th>
                <th className="px-4 py-2.5 font-medium w-20">Free</th>
                <th className="px-4 py-2.5 font-medium w-44">Usage</th>
                <th className="px-4 py-2.5 font-medium">Mounted on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-sm text-slate-500">Loading…</td></tr>
              ) : drives.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-sm text-slate-500">No drives found.</td></tr>
              ) : (
                drives.map((d, i) => {
                  const pct = parseInt(d.usePercent) || 0;
                  const c = usageColor(pct);
                  return (
                    <tr key={i} className="hover:bg-slate-900/40 transition">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-200">{d.filesystem}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{d.size}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{d.used}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{d.available}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${c.chip} ${c.text}`}>
                            {d.usePercent}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{d.mountedOn}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Largest folders / files */
        <div className="border border-slate-800 rounded-md overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500 flex items-center gap-2">
            <span>Results for</span>
            <span className="font-mono text-sky-400 normal-case">{path}</span>
          </div>
          <div className="overflow-y-auto max-h-[440px]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500 sticky top-0 bg-slate-950">
                  <th className="px-4 py-2.5 font-medium w-28">Size</th>
                  <th className="px-4 py-2.5 font-medium">Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={2} className="text-center py-10 text-sm text-slate-500">Scanning…</td></tr>
                ) : largest.length === 0 ? (
                  <tr><td colSpan={2} className="text-center py-10 text-sm text-slate-500">No results yet — run a scan above.</td></tr>
                ) : (
                  largest.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-900/40 transition">
                      <td className="px-4 py-2 font-mono text-xs text-sky-400">{item.size}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-300 truncate max-w-xl" title={item.path}>
                        {item.path}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}