
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Zap,
  Eye,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Filter,
  Terminal,
  Power,
  PowerOff
} from "lucide-react";
import { TerminalOutput, ActionButton } from "./shared";

/* ================= SERVICES MODULE ================= */
export function ServicesModule() {
  const [services, setServices] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      const res = await api.get("/system/services");
      setServices(res.data.services || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleAction = async (action: string, service: string) => {
    setLoading(true);
    try {
      const res = await api.post("/system/services", { action, serviceName: service });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchServices();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Execution Error encountered.");
    }
    setLoading(false);
  };

  const viewLogs = async (service: string) => {
    try {
      const res = await api.get(`/system/services?action=logs&name=${service}`);
      setCommand(`journalctl -u ${service} -n 50`);
      setOutput(res.data.logs);
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Failed to parse system logs.");
    }
  };

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Service Manager</h2>
            <p className="text-xs text-slate-400 mt-0.5">Control systemd background units and execution layers</p>
          </div>
        </div>

        {/* Search Filter & Target Action Block */}
        <div className="flex items-center gap-2 max-w-md w-full sm:w-auto">
          <div className="relative flex items-center flex-1 sm:w-64">
            <Filter className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter active units..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
            />
          </div>
          <ActionButton onClick={fetchServices} variant="secondary">
            <RefreshCw className="w-3.5 h-3.5" />
          </ActionButton>
        </div>
      </div>

      {/* Dynamic Terminal Output Module */}
      {(command || output || loading) && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
          <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">Live Output Console</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}

      {/* Main Table Segment */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">System Units List</h3>
          </div>
          <span className="text-xs font-medium text-slate-500">{filtered.length} units matched</span>
        </div>

        <div className="overflow-x-auto max-h-[550px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Service Identifier</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Substate</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Management Console</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-sm text-slate-500 font-medium">
                    No matching processes captured on this host layer.
                  </td>
                </tr>
              ) : (
                filtered.map((svc) => {
                  const isActive = svc.active === "active";
                  const isFailed = svc.active === "failed";
                  
                  return (
                    <tr key={svc.name} className="hover:bg-slate-800/30 transition group">
                      <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-200 group-hover:text-orange-400 transition">
                        {svc.name}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                            isActive
                              ? "bg-green-500/10 border-green-500/20 text-green-400"
                              : isFailed
                              ? "bg-red-500/10 border-red-500/20 text-red-400"
                              : "bg-slate-800 border-slate-700/60 text-slate-400"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? "bg-green-400 animate-pulse" : isFailed ? "bg-red-400" : "bg-slate-500"}`} />
                          {svc.active}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                        {svc.sub || <span className="text-slate-600 italic">none</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1 bg-slate-950/60 p-1 border border-slate-800 rounded-lg">
                          {/* Unit Lifecycles */}
                          <button 
                            onClick={() => handleAction("start", svc.name)} 
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-green-400 rounded transition border border-slate-800/50" 
                            title="Start Unit"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleAction("stop", svc.name)} 
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-red-400 rounded transition border border-slate-800/50" 
                            title="Stop Unit"
                          >
                            <Square className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleAction("restart", svc.name)} 
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-blue-400 rounded transition border border-slate-800/50" 
                            title="Restart Unit"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleAction("reload", svc.name)} 
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-yellow-500 rounded transition border border-slate-800/50" 
                            title="Reload Configuration"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          <div className="w-px bg-slate-800 mx-0.5 self-stretch" />

                          {/* Unit Boot Configuration states */}
                          <button 
                            onClick={() => handleAction("enable", svc.name)} 
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-500 rounded transition border border-slate-800/50" 
                            title="Enable on Startup"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleAction("disable", svc.name)} 
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-orange-400 rounded transition border border-slate-800/50" 
                            title="Disable on Startup"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                          </button>

                          <div className="w-px bg-slate-800 mx-0.5 self-stretch" />

                          {/* Log Reader */}
                          <button 
                            onClick={() => viewLogs(svc.name)} 
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition border border-slate-800/50" 
                            title="Inspect Logs (journalctl)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
