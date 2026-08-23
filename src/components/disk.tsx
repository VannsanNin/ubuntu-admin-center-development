
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  HardDrive,
  Folder,
  File,
  Layers,
  Search,
  PieChart
} from "lucide-react";
import { ActionButton } from "./shared";

/* ================= DISK ANALYZER MODULE ================= */
export function DiskModule() {
  const [drives, setDrives] = useState<any[]>([]);
  const [path, setPath] = useState("/");
  const [largest, setLargest] = useState<any[]>([]);
  const [tab, setTab] = useState<"drives" | "folders" | "files">("drives");

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get("/system/disk");
      setDrives(res.data.drives || []);
    } catch (err) {
      console.error("Storage system telemetry acquisition fault:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchLargest = async (action: string) => {
    try {
      const res = await api.get(`/system/disk?action=${action}&path=${encodeURIComponent(path)}`);
      setLargest(res.data.items || []);
      setTab(action === "largestFolders" ? "folders" : "files");
    } catch (err) {
      console.error("Directory trace allocation error:", err);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Disk Space & Volume Analyzer</h2>
            <p className="text-xs text-slate-400 mt-0.5">Audit logical hardware boundaries, map heavy file trees, and locate bloated dependencies</p>
          </div>
        </div>
      </div>

      {/* Operations Panel Dashboard Utility */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 backdrop-blur-sm">
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            onClick={() => setTab("drives")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition inline-flex items-center gap-1.5 ${
              tab === "drives"
                ? "bg-slate-800 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Mount Partitions
          </button>
          <button
            onClick={() => fetchLargest("largestFolders")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition inline-flex items-center gap-1.5 ${
              tab === "folders"
                ? "bg-slate-800 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            Largest Folders
          </button>
          <button
            onClick={() => fetchLargest("largestFiles")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition inline-flex items-center gap-1.5 ${
              tab === "files"
                ? "bg-slate-800 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <File className="w-3.5 h-3.5" />
            Largest Files
          </button>
        </div>

        <div className="w-px bg-slate-800 h-6 hidden lg:block mx-1" />

        {/* Dynamic target scan parameter workspace */}
        <div className="relative flex items-center flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="Absolute server volume checkpoint target (e.g. /var/log or /home)..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm font-mono transition outline-none placeholder:text-slate-700"
          />
        </div>

        {tab !== "drives" && (
          <div className="flex shrink-0 justify-end">
            <ActionButton onClick={() => fetchLargest(tab === "folders" ? "largestFolders" : "largestFiles")}>
              Re-Scan Context
            </ActionButton>
          </div>
        )}
      </div>

      {/* Main Tabular View Render Node */}
      {tab === "drives" ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-900/90 border-b border-slate-800">
                <tr>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Device System Pool</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Total</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Used Assets</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Free Pool</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-48">Usage Bar Chart</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Mount Absolute Point</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {drives.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-sm text-slate-500 font-medium">
                      No active storage partition descriptors parsed.
                    </td>
                  </tr>
                ) : (
                  drives.map((d, i) => {
                    const rawPct = parseInt(d.usePercent) || 0;
                    const isCritical = rawPct > 90;
                    const isWarning = rawPct > 70;

                    return (
                      <tr key={i} className="hover:bg-slate-800/30 transition group">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-200 group-hover:text-orange-400 transition">
                          {d.filesystem}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-300 font-mono">{d.size}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-400 font-mono">{d.used}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-400 font-mono">{d.available}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {/* Inline Visual Allocation Bar */}
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80 p-px">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isCritical ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-green-500"
                                }`}
                                style={{ width: `${Math.min(rawPct, 100)}%` }}
                              />
                            </div>
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 ${
                              isCritical 
                                ? "bg-red-500/10 text-red-400 border border-red-500/10" 
                                : isWarning 
                                ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10" 
                                : "bg-green-500/10 text-green-400 border border-green-500/10"
                            }`}>
                              {d.usePercent}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">{d.mountedOn}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Largest allocation item results matrix */
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
          <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <PieChart className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Heavy Volumetric Scopes Found inside: <span className="font-mono text-orange-400 lowercase">{path}</span>
            </span>
          </div>

          <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-800">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
                <tr>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-32">Weight Index</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Absolute Resource VFS Target String</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {largest.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center py-12 text-sm text-slate-500 font-medium italic">
                      No tracing statistics compiled. Click a trigger target above to run analyzer routines.
                    </td>
                  </tr>
                ) : (
                  largest.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-orange-400/90 bg-slate-950/20">
                        {item.size}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-300 font-mono tracking-wide truncate max-w-xl md:max-w-3xl" title={item.path}>
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