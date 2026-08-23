
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Shield,
  Trash2,
  Terminal,
  Activity,
  Globe,
  Network
} from "lucide-react";
import { TerminalOutput, ActionButton, ConfirmDialog } from "./shared";

/* ================= FIREWALL MODULE ================= */
export function FirewallModule() {
  const [status, setStatus] = useState<any>(null);
  const [port, setPort] = useState("");
  const [protocol, setProtocol] = useState("tcp");
  const [fromAddr, setFromAddr] = useState("");
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get("/system/firewall");
      setStatus(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleAction = async (action: string) => {
    setLoading(true);
    try {
      const res = await api.post("/system/firewall", { action, port, protocol, fromAddr });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchStatus();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Error adjusting firewall state.");
    }
    setLoading(false);
  };

  const deleteRule = async (ruleNum: number) => {
    setLoading(true);
    try {
      const res = await api.post("/system/firewall", { action: "delete", port: String(ruleNum), protocol: "tcp" });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchStatus();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Error deleting firewall rule.");
    }
    setLoading(false);
    setConfirmDelete(null);
  };

  const isFirewallActive = status?.status === "active";

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Security Firewall</h2>
            <p className="text-xs text-slate-400 mt-0.5">Control network connection states, UFW matrices, and port-forward bounds</p>
          </div>
        </div>

        {/* Global Operational Toggles */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-2 border border-slate-800/80 rounded-xl backdrop-blur-sm">
          <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            isFirewallActive
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${isFirewallActive ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
            Status: {isFirewallActive ? "Active Protection" : "Unprotected State"}
          </div>
          
          <div className="w-px bg-slate-800 h-6 hidden sm:block" />

          <div className="flex gap-1.5">
            <ActionButton onClick={() => handleAction("enable")}>Enable</ActionButton>
            <ActionButton onClick={() => handleAction("disable")} variant="danger">
              Disable
            </ActionButton>
            <ActionButton onClick={() => handleAction("reset")} variant="secondary">
              Reset Rulebook
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Access Provision Matrix Form */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5 text-orange-500" />
            Provision Access Vector
          </h3>
        </div>
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex items-center flex-1 lg:max-w-xs">
            <span className="text-xs font-mono font-bold text-slate-600 absolute left-3 pointer-events-none">PORT</span>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="e.g. 22, 80, 443"
              className="w-full pl-14 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm font-mono transition outline-none placeholder:text-slate-700"
            />
          </div>

          <div className="relative flex items-center">
            <Activity className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-lg text-sm transition outline-none appearance-none cursor-pointer font-mono text-slate-300"
            >
              <option value="tcp">Protocol: TCP</option>
              <option value="udp">Protocol: UDP</option>
            </select>
          </div>

          <div className="relative flex items-center flex-1">
            <Globe className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              value={fromAddr}
              onChange={(e) => setFromAddr(e.target.value)}
              placeholder="Source Address Context (optional, e.g. 192.168.1.50)..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm font-mono transition outline-none placeholder:text-slate-700"
            />
          </div>

          <div className="flex gap-2 justify-end lg:self-auto pt-2 lg:pt-0">
            <ActionButton onClick={() => handleAction("allow")}>
              Allow Vector
            </ActionButton>
            <ActionButton onClick={() => handleAction("deny")} variant="danger">
              Deny Vector
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Dynamic Terminal Output Module */}
      {(command || output || loading) && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
          <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">Network Routing Execution Output</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}

      {/* Rules Registry Stack Table */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFirewallActive ? "bg-orange-400" : "bg-slate-600"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isFirewallActive ? "bg-orange-500" : "bg-slate-500"}`}></span>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Registered Rulebook</h3>
          </div>
          <span className="text-xs font-medium text-slate-500">{status?.rules?.length || 0} policy vectors</span>
        </div>

        <div className="overflow-x-auto max-h-[450px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-16">Index</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Policy Definition Line</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {!status?.rules || status.rules.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-sm text-slate-500 font-medium italic">
                    No custom packet filters mapped in firewall bounds. Host defaults apply.
                  </td>
                </tr>
              ) : (
                status.rules.map((rule: any) => (
                  <tr key={rule.number} className="hover:bg-slate-800/30 transition group">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-500 group-hover:text-orange-400/70 transition">
                      #{rule.number}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-300 leading-relaxed">
                      {rule.line}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex bg-slate-950/40 p-0.5 border border-slate-800/60 rounded-md">
                        <button
                          onClick={() => setConfirmDelete(String(rule.number))}
                          className="p-1 bg-red-950/20 hover:bg-red-900/30 rounded text-red-400 border border-red-900/20 transition"
                          title="Purge Policy Entry"
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

      {/* Safety Gate Warning Interceptor */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Purge Firewall Policy Row"
        message={`Confirm complete structural removal of packet filter line reference index #${confirmDelete}? This can instantly alter the network connectivity envelope.`}
        onConfirm={() => confirmDelete && deleteRule(parseInt(confirmDelete))}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}