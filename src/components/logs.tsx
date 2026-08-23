
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  ScrollText,
  RefreshCw,
  Download,
  Filter,
  Layers,
  Hash,
  Terminal
} from "lucide-react";
import { ActionButton } from "./shared";

/* ================= LOGS MODULE ================= */
export function LogsModule() {
  const [logType, setLogType] = useState("syslog");
  const [lines, setLines] = useState(100);
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [raw, setRaw] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get(`/system/logs?type=${logType}&lines=${lines}&search=${search}`);
      setLogs(res.data.lines || []);
      setRaw(res.data.raw || "");
    } catch (err) {
      console.error(err);
    }
  }, [logType, lines, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const logTypes = [
    { value: "syslog", label: "System Log" },
    { value: "auth", label: "Auth Log" },
    { value: "kern", label: "Kernel Log" },
    { value: "dmesg", label: "Dmesg Buffer" },
    { value: "docker", label: "Docker Daemon" },
    { value: "nginx", label: "Nginx Access" },
    { value: "nginxError", label: "Nginx Error" },
    { value: "apache", label: "Apache Access" },
    { value: "apacheError", label: "Apache Error" },
  ];

  const handleExport = () => {
    const blob = new Blob([raw], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${logType}_${new Date().toISOString().split('T')[0]}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">System Log Aggregator</h2>
            <p className="text-xs text-slate-400 mt-0.5">Stream host kernel metrics, proxy application traces, and access buffers</p>
          </div>
        </div>
      </div>

      {/* Filter and Control Parameters Panel */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 flex flex-col xl:flex-row items-stretch xl:items-center gap-3 backdrop-blur-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
          {/* Log Category Selector */}
          <div className="relative flex items-center">
            <Layers className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-lg text-sm transition outline-none appearance-none cursor-pointer text-slate-300"
            >
              {logTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Lines Limit Counter */}
          <div className="relative flex items-center">
            <Hash className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="number"
              value={lines}
              onChange={(e) => setLines(parseInt(e.target.value) || 100)}
              placeholder="Lines limit"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none font-mono"
            />
          </div>

          {/* Realtime String Inversion Filter */}
          <div className="relative flex items-center">
            <Filter className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Regex parse or regex token..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600 font-mono"
            />
          </div>
        </div>

        {/* Global Control Terminal Actions */}
        <div className="flex gap-2 justify-end shrink-0 pt-2 xl:pt-0 border-t border-slate-800/60 xl:border-0">
          <ActionButton onClick={fetchLogs}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Sync Logs
          </ActionButton>
          <ActionButton onClick={handleExport} variant="secondary">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Archive
          </ActionButton>
        </div>
      </div>

      {/* Main Stream Terminal Screen Wrapper */}
      <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl bg-slate-950">
        {/* Internal Shell Header metadata context */}
        <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">TTY System Telemetry View</span>
          </div>
          <div className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800/60">
            {logType}
          </div>
        </div>

        {/* Output Stream Canvas viewport layout */}
        <div className="p-4 font-mono text-[11px] leading-relaxed max-h-[600px] overflow-y-auto space-y-1 bg-slate-950/80 scrollbar-thin scrollbar-thumb-slate-800 select-text">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-slate-600 italic">
              No matching diagnostic trace rows recovered inside target stream bounds.
            </div>
          ) : (
            logs.map((line, i) => {
              const isError = line.type === "error";
              const isWarning = line.type === "warning";
              
              return (
                <div
                  key={i}
                  className={`flex items-start gap-4 px-2 py-0.5 rounded transition ${
                    isError
                      ? "bg-red-500/5 text-red-400/90 hover:bg-red-500/10"
                      : isWarning
                      ? "bg-yellow-500/5 text-yellow-400/90 hover:bg-yellow-500/10"
                      : "text-slate-300 hover:bg-slate-900/40"
                  }`}
                >
                  {/* Pseudo incremental padding frame column index */}
                  <span className="text-slate-600 select-none text-right w-8 inline-block shrink-0 border-r border-slate-900 pr-2">
                    {i + 1}
                  </span>
                  
                  {/* Row Payload Text string context */}
                  <span className="break-all whitespace-pre-wrap font-light tracking-wide flex-1">
                    {line.text}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}