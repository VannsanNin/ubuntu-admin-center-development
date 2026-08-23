
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Globe,
  Terminal,
  Server,
  Network,
  Cpu,
  ArrowRightLeft,
  Activity,
  Search
} from "lucide-react";
import { TerminalOutput, ActionButton } from "./shared";

/* ================= NETWORK MODULE ================= */
export function NetworkModule() {
  const [network, setNetwork] = useState<any>(null);
  const [target, setTarget] = useState("google.com");
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchNetwork = useCallback(async () => {
    try {
      const res = await api.get("/system/network");
      setNetwork(res.data);
    } catch (err) {
      console.error("Failed to query hardware interface layer:", err);
    }
  }, []);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

  const handleAction = async (action: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/system/network?action=${action}&target=${target}`);
      setCommand(`${action} ${target}`);
      setOutput(res.data.output || "");
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Diagnostic request rejected by host interface.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Network Diagnostics & Interfaces</h2>
            <p className="text-xs text-slate-400 mt-0.5">Map hardware interfaces, trace route packets, and audit active listening socket descriptors</p>
          </div>
        </div>
      </div>

      {/* Network Hardware Stat Cards Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card: IP Allocation */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Server className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Allocated IPs</span>
          </div>
          <div className="space-y-1 max-h-[72px] overflow-y-auto scrollbar-thin">
            {network?.ipAddresses?.map((ip: string) => (
              <p key={ip} className="font-mono text-xs font-semibold text-slate-200">{ip}</p>
            )) || <p className="text-xs font-mono text-slate-600">---</p>}
          </div>
        </div>

        {/* Card: Default Gateway */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <ArrowRightLeft className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Default Gateway</span>
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-slate-200">{network?.gateway || "---"}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-1">Upstream Routing Address</p>
          </div>
        </div>

        {/* Card: Nameservers */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Network className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold uppercase tracking-wider">DNS Servers</span>
          </div>
          <div className="space-y-1 max-h-[72px] overflow-y-auto scrollbar-thin">
            {network?.dns?.map((d: string) => (
              <p key={d} className="font-mono text-xs font-semibold text-slate-200">{d}</p>
            )) || <p className="text-xs font-mono text-slate-600">---</p>}
          </div>
        </div>

        {/* Card: Hardware Adapters */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Adapters / State</span>
          </div>
          <div className="space-y-1.5 max-h-[72px] overflow-y-auto scrollbar-thin">
            {network?.interfaces?.map((iface: any) => {
              const isUp = iface.state?.toLowerCase() === "up";
              return (
                <div key={iface.name} className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-semibold">{iface.name}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    isUp ? "bg-green-500/10 text-green-400" : "bg-slate-950 text-slate-500"
                  }`}>
                    {iface.state?.toUpperCase() || "DOWN"}
                  </span>
                </div>
              );
            }) || <p className="text-xs font-mono text-slate-600">---</p>}
          </div>
        </div>
      </div>

      {/* Network Diagnostic Execution Workspace */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center gap-3 backdrop-blur-sm">
        <div className="relative flex items-center flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target node (e.g. 1.1.1.1 or cloudflare.com)..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm font-mono transition outline-none placeholder:text-slate-700"
          />
        </div>
        
        <div className="flex items-center gap-2 self-end md:self-auto">
          <ActionButton onClick={() => handleAction("ping")}>Ping</ActionButton>
          <ActionButton onClick={() => handleAction("traceroute")} variant="secondary">
            Traceroute
          </ActionButton>
          <ActionButton onClick={() => handleAction("speedtest")} variant="secondary">
            Speed Test
          </ActionButton>
        </div>
      </div>

      {/* Dynamic Terminal Output Module */}
      {(command || output || loading) && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
          <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">Network ICMP Utility Stream Output</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}

      {/* Active Port Socket Listening Map */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Internet Connections (Listening Ports)</h3>
          </div>
          <span className="text-xs font-mono font-medium text-slate-500">{network?.ports?.length || 0} descriptors</span>
        </div>

        <div className="overflow-x-auto max-h-[350px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-36">Socket State</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Local Boundary Address</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Process Identifier (PID)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {!network?.ports || network.ports.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-sm text-slate-500 font-medium italic">
                    No active interface socket descriptors bound or exposed.
                  </td>
                </tr>
              ) : (
                network.ports.map((port: any, i: number) => {
                  const isListen = port.state === "LISTEN";

                  return (
                    <tr key={i} className="hover:bg-slate-800/30 transition group">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide border ${
                          isListen
                            ? "bg-green-500/10 border-green-500/20 text-green-400"
                            : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}>
                          <span className={`w-1 h-1 rounded-full mr-1.5 ${isListen ? "bg-green-400" : "bg-slate-600"}`} />
                          {port.state || "UNKNOWN"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-200 font-medium">
                        {port.local}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                        {port.process || "---"}
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