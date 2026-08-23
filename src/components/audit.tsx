
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  ScrollText,
  Activity,
  ShieldAlert,
  Clock,
  Terminal,
  Globe
} from "lucide-react";

/* ================= AUDIT LOGS MODULE ================= */
export function AuditModule() {
  const [logs, setLogs] = useState<any[]>([]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get("/audit-logs");
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error("Security ledger sync fault:", err);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Security & Orchestration Audit Ledger</h2>
            <p className="text-xs text-slate-400 mt-0.5">Immutable record of API calls, shell execution parameters, and cross-module state transitions</p>
          </div>
        </div>

        {/* Live Stream Heartbeat Component */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-400 self-start sm:self-auto shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Live Tail Polling (5s)</span>
        </div>
      </div>

      {/* Main Ledger Event Table Matrix */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-48">
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Timestamp Frame</span>
                </th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-36">
                  <span className="flex items-center gap-1.5"><ShieldAlert className="w-3 h-3" /> Sub-System Module</span>
                </th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-40">
                  <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> Event Action Call</span>
                </th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><Terminal className="w-3 h-3" /> Invoked Command String</span>
                </th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-40">
                  <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> Source Host IP</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-sans">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-sm text-slate-500 font-medium italic">
                    Security tracking table unpopulated. No diagnostic entries encountered.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition group">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : "---"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-slate-400 uppercase tracking-wide">
                        {log.module || "core"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200 group-hover:text-orange-400 transition text-xs font-semibold">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 max-w-xs md:max-w-md lg:max-w-xl truncate" title={log.command}>
                      {log.command ? (
                        <code className="bg-slate-950/60 text-orange-400/90 border border-slate-900 px-2 py-0.5 rounded font-mono text-[11px] block truncate select-all">
                          {log.command}
                        </code>
                      ) : (
                        <span className="text-slate-600 font-mono text-xs pl-2">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {log.ipAddress || "::1 (Local)"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}