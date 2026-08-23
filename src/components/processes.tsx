
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Activity,
  Eye,
  Trash2,
  X,
  Search,
  SlidersHorizontal,
  Terminal,
} from "lucide-react";
import { TerminalOutput, ActionButton, ConfirmDialog } from "./shared";

/* ================= PROCESSES MODULE ================= */
export function ProcessesModule() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("cpu");
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmPid, setConfirmPid] = useState<number | null>(null);
  const [selectedProc, setSelectedProc] = useState<any>(null);

  const fetchProcesses = useCallback(async () => {
    try {
      const res = await api.get(`/system/processes?sort=${sort}&search=${search}`);
      setProcesses(res.data.processes || []);
    } catch (err) {
      console.error(err);
    }
  }, [sort, search]);

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 3000);
    return () => clearInterval(interval);
  }, [fetchProcesses]);

  const killProcess = async (pid: number) => {
    setLoading(true);
    try {
      const res = await api.post("/system/processes", { pid, signal: "TERM" });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchProcesses();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Failed to issue termination call.");
    }
    setLoading(false);
    setConfirmPid(null);
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Process Manager</h2>
            <p className="text-xs text-slate-400 mt-0.5">Real-time task monitor and process life-cycle control</p>
          </div>
        </div>

        {/* Query Controls Grid */}
        <div className="flex items-center gap-2 max-w-lg w-full sm:w-auto">
          <div className="relative flex items-center flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by string or PID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
            />
          </div>
          <div className="relative flex items-center">
            <SlidersHorizontal className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-lg text-sm transition outline-none appearance-none cursor-pointer text-slate-300"
            >
              <option value="cpu">Sort: CPU</option>
              <option value="mem">Sort: Memory</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic Terminal Output Module */}
      {(command || output || loading) && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
          <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">Live Execution Console</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}

      {/* Main Metric Table */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Host Thread Stack</h3>
          </div>
          <span className="text-xs font-medium text-slate-500">Auto-refresh every 3s</span>
        </div>

        <div className="overflow-x-auto max-h-[550px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-20">PID</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-28">User</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">CPU %</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">MEM %</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Command Target</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {processes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-slate-500 font-medium">
                    No matching systemic processes captured on this poll event.
                  </td>
                </tr>
              ) : (
                processes.map((proc) => (
                  <tr key={proc.pid} className="hover:bg-slate-800/30 transition group">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-orange-400/90">{proc.pid}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-300 font-medium">{proc.user}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-medium text-slate-200">{proc.cpu}%</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-medium text-slate-200">{proc.mem}%</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 max-w-xs md:max-w-xl truncate font-mono">
                      {proc.command}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5 bg-slate-950/40 p-0.5 border border-slate-800/60 rounded-md">
                        <button
                          onClick={() => setSelectedProc(proc)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                          title="Inspect Metrics"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmPid(proc.pid)}
                          className="p-1 bg-red-950/20 hover:bg-red-900/30 rounded text-red-400 transition border border-red-900/20"
                          title="SIGTERM Thread"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Detail Modal */}
      {selectedProc && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl max-w-lg w-full p-5 flex flex-col shadow-2xl scale-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold tracking-tight text-slate-200">System Thread Metrics</h3>
                <p className="text-xs font-mono text-orange-500 mt-0.5">Instance PID Reference: {selectedProc.pid}</p>
              </div>
              <button
                onClick={() => setSelectedProc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Field Stack Data List */}
            <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-slate-800/60 max-h-[50vh] overflow-y-auto scrollbar-thin">
              {[
                { label: "Process PID", value: selectedProc.pid },
                { label: "Owner Context", value: selectedProc.user },
                { label: "CPU Threshold", value: `${selectedProc.cpu}%` },
                { label: "Memory Threshold", value: `${selectedProc.mem}%` },
                { label: "Virtual Size (VSZ)", value: selectedProc.vsz },
                { label: "Resident Set Size (RSS)", value: selectedProc.rss },
                { label: "Target TTY", value: selectedProc.tty },
                { label: "Execution Flag (STAT)", value: selectedProc.stat },
                { label: "Launch Time", value: selectedProc.start },
                { label: "Aggregated CPU Time", value: selectedProc.time },
                { label: "String Descriptor", value: selectedProc.command, isCommand: true },
              ].map((f) => (
                <div
                  key={f.label}
                  className={`flex flex-col sm:flex-row sm:justify-between items-start sm:items-center py-1.5 border-b border-slate-800/40 last:border-0 ${
                    f.isCommand ? "pt-2" : ""
                  }`}
                >
                  <span className="text-xs font-medium text-slate-400 mb-0.5 sm:mb-0">{f.label}</span>
                  <span
                    className={`text-xs font-mono text-slate-200 break-all text-left sm:text-right sm:ml-6 max-w-full sm:max-w-[280px] ${
                      f.isCommand ? "bg-slate-900/60 p-1.5 rounded border border-slate-800 w-full text-left font-light block mt-1" : ""
                    }`}
                  >
                    {f.value || <span className="text-slate-700 italic">unassigned</span>}
                  </span>
                </div>
              ))}
            </div>

            {/* Action Tier footer */}
            <div className="flex justify-end mt-5 pt-3 border-t border-slate-800 gap-2">
              <button
                onClick={() => setSelectedProc(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg border border-slate-700 transition"
              >
                Dismiss
              </button>
              <ActionButton
                onClick={() => {
                  setConfirmPid(selectedProc.pid);
                  setSelectedProc(null);
                }}
                variant="danger"
              >
                Terminate Signal
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Safe Trigger Confirm Modals */}
      <ConfirmDialog
        open={confirmPid !== null}
        title="Kill Process Target"
        message={`Confirm complete execution of SIGTERM on active thread process identifier ${confirmPid}? This can destabilize sub-tasks.`}
        onConfirm={() => confirmPid && killProcess(confirmPid)}
        onCancel={() => setConfirmPid(null)}
      />
    </div>
  );
}