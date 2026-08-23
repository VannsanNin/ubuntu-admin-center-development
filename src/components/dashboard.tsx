
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { TauriStream } from "@/lib/streams";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Clock,
  Users,
  Thermometer,
  Server,
  Loader2,
  Terminal,
  ActivitySquare
} from "lucide-react";

interface SystemInfo {
  hostname: string;
  version: string;
  kernel: string;
  uptime: string;
  loadAverage: string[];
  cpuUsage: string;
  memory: { total: string; used: string; percentage: number };
  swap: { total: string; used: string };
  disk: { total: string; used: string; free: string; percentage: string };
  network: { interface: string; rx: string; tx: string }[];
  loggedInUsers: { user: string; tty: string; from: string }[];
  processCount: number;
  temperatures: string[];
}

interface GpuInfo {
  name: string;
  usage: number;
  memUsed: number;
  memTotal: number;
  temp: number | null;
}

interface StreamData {
  cpuUsage: string;
  memory: { total: string; used: string; percentage: number };
  loadAverage: string[];
  processCount: number;
  network?: { rx: string; tx: string };
  gpus?: GpuInfo[];
}

interface HistPoint {
  t: string;
  cpu: number;
  mem: number;
  rx: number;
  tx: number;
  [key: string]: string | number;
}

const HIST_MAX = 60;
const GPU_UTIL_COLORS = ["#ec4899", "#14b8a6"];
const GPU_VRAM_COLORS = ["#f472b6", "#5eead4"];

function fmtRate(bytesPerSec: number): string {
  if (!isFinite(bytesPerSec) || bytesPerSec < 0) return "0 B/s";
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

function parseDiskPct(pct: string): number {
  return parseFloat(pct.replace("%", "")) || 0;
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-slate-900/40 border border-slate-800/80 rounded-xl backdrop-blur-sm shadow-sm text-slate-400 ${className}`}>
      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-3 h-52">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "rgba(2,6,23,0.92)",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#e2e8f0",
};

export default function DashboardPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hist, setHist] = useState<HistPoint[]>([]);
  const [netRate, setNetRate] = useState({ rx: 0, tx: 0 });
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const prevNet = useRef<{ rx: number; tx: number } | null>(null);

  useEffect(() => {
    api.get("/system/info").then((res) => {
      setInfo(res.data);
      setLoading(false);
    });
  }, []);

  const pushPoint = (data: StreamData) => {
    const rx = parseInt(data.network?.rx ?? "NaN", 10);
    const tx = parseInt(data.network?.tx ?? "NaN", 10);
    let rxRate = 0;
    let txRate = 0;
    if (!isNaN(rx) && !isNaN(tx) && prevNet.current) {
      rxRate = Math.max(0, (rx - prevNet.current.rx) / 1);
      txRate = Math.max(0, (tx - prevNet.current.tx) / 1);
    }
    if (!isNaN(rx) && !isNaN(tx)) prevNet.current = { rx, tx };

    setNetRate({ rx: rxRate, tx: txRate });
    const gpuList = data.gpus ?? [];
    setGpus(gpuList);
    setHist((prev) => {
      const point: HistPoint = {
        t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        cpu: parseFloat(data.cpuUsage) || 0,
        mem: data.memory.percentage || 0,
        rx: rxRate / 1024,
        tx: txRate / 1024,
      };
      gpuList.forEach((g, i) => {
        point[`g${i}`] = g.usage || 0;
        point[`v${i}`] =
          g.memTotal > 0 ? Math.round((g.memUsed / g.memTotal) * 100) : 0;
      });
      const next = [...prev, point];
      return next.length > HIST_MAX ? next.slice(next.length - HIST_MAX) : next;
    });
  };

  useEffect(() => {
    // Live telemetry over the Tauri event bridge (replaces /api/system/ws).
    const ws = new TauriStream("stats");
    let alive = true;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    ws.onmessage = (event) => {
      try {
        const data: StreamData = JSON.parse(event.data);
        if (!alive) return;
        setStreamData(data);
        pushPoint(data);
      } catch (err) {
        console.error("Failed to parse telemetry frame:", err);
      }
    };

    ws.onclose = () => {
      console.warn("Telemetry stream closed, falling back to REST poll sequence");
      intervalId = setInterval(() => {
        api.get("/system/info").then((res) => {
          if (!alive) return;
          const data: StreamData = res.data;
          setStreamData(data);
          pushPoint(data);
        });
      }, 1000);
    };

    return () => {
      alive = false;
      ws.close();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  if (loading || !info) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 stroke-[1.5]" />
        <span className="text-xs text-slate-500 font-mono">Assembling socket core buffers...</span>
      </div>
    );
  }

  const displayData = streamData || info;
  const cpuPercent = parseFloat(displayData.cpuUsage) || 0;
  const diskPercent = parseDiskPct(info.disk.percentage);
  const diskUsedGB = parseFloat(info.disk.used) || 0;
  const diskFreeGB = parseFloat(info.disk.free) || 0;
  const memTotalMB = parseInt(displayData.memory.total, 10) || 0;
  const memUsedMB = parseInt(displayData.memory.used, 10) || 0;

  const axisProps = {
    stroke: "currentColor",
    tick: { fill: "currentColor", fontSize: 10 },
    axisLine: false,
    tickLine: false,
  } as const;

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{info.hostname}</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              {info.version} · <span className="text-slate-500">Kernel {info.kernel}</span>
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900/40 border border-slate-800 rounded-xl text-slate-400 font-mono text-xs self-start sm:self-auto shadow-sm">
          <Clock className="w-3.5 h-3.5 text-orange-500" />
          <span>Uptime: {info.uptime}</span>
        </div>
      </div>

      {/* Primary stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Cpu}
          label="CPU Core Load"
          value={`${displayData.cpuUsage}%`}
          subvalue={`Load Avg: ${(displayData.loadAverage || []).join(" ")}`}
          percentage={cpuPercent}
          barColor="bg-blue-500"
        />
        <StatCard
          icon={MemoryStick}
          label="Physical RAM Memory"
          value={`${displayData.memory.percentage}%`}
          subvalue={`${memUsedMB >= 1024 ? `${(memUsedMB / 1024).toFixed(1)} GB` : `${memUsedMB} MB`} of ${memTotalMB >= 1024 ? `${(memTotalMB / 1024).toFixed(1)} GB` : `${memTotalMB} MB`}`}
          percentage={displayData.memory.percentage}
          barColor="bg-green-500"
        />
        <StatCard
          icon={HardDrive}
          label="Persistent Disk Volume"
          value={info.disk.percentage}
          subvalue={`${info.disk.used} used of ${info.disk.total}`}
          percentage={diskPercent}
          barColor="bg-purple-500"
        />
        <StatCard
          icon={Network}
          label="Network Throughput"
          value={fmtRate(netRate.tx)}
          subvalue={`Down ${fmtRate(netRate.rx)} · Up ${fmtRate(netRate.tx)}`}
          percentage={Math.min((netRate.rx + netRate.tx) / (1024 * 102), 100)}
          barColor="bg-cyan-500"
        />
      </div>

      {/* Live graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={`CPU Usage (%) — live · now ${cpuPercent.toFixed(1)}%`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hist} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} vertical={false} />
              <XAxis dataKey="t" {...axisProps} minTickGap={48} />
              <YAxis domain={[0, 100]} {...axisProps} width={40} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#94a3b8" }} />
              <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" strokeWidth={2} fill="url(#cpuFill)" isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Memory Usage (%) — live · now ${displayData.memory.percentage}%`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hist} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="memFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} vertical={false} />
              <XAxis dataKey="t" {...axisProps} minTickGap={48} />
              <YAxis domain={[0, 100]} {...axisProps} width={40} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#94a3b8" }} />
              <Area type="monotone" dataKey="mem" name="RAM %" stroke="#22c55e" strokeWidth={2} fill="url(#memFill)" isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Network I/O (KB/s) — ↓ ${fmtRate(netRate.rx)} · ↑ ${fmtRate(netRate.tx)}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hist} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} vertical={false} />
              <XAxis dataKey="t" {...axisProps} minTickGap={48} />
              <YAxis {...axisProps} width={40} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(value, name) => [
                  `${Number(value ?? 0).toFixed(1)} KB/s`,
                  name === "rx" ? "Download" : "Upload",
                ]}
              />
              <Line type="monotone" dataKey="rx" name="rx" stroke="#f97316" strokeWidth={2} isAnimationActive={false} dot={false} />
              <Line type="monotone" dataKey="tx" name="tx" stroke="#a855f7" strokeWidth={2} isAnimationActive={false} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Storage (/) — ${diskPercent}% used · ${info.disk.free} free`}>
          <div className="relative h-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Used", value: diskUsedGB },
                    { name: "Free", value: Math.max(diskFreeGB, 0) },
                  ]}
                  dataKey="value"
                  innerRadius="62%"
                  outerRadius="88%"
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                  paddingAngle={2}
                >
                  <Cell fill="#a855f7" />
                  <Cell fill="#334155" />
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) =>
                    [`${Number(value ?? 0).toFixed(1)} GB`, name as string]
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold font-mono text-white">{diskPercent}%</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">of {info.disk.total}</span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* GPU live graph */}
      {gpus.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <ChartCard
            title={`GPU Usage (%) — ${gpus
              .map((g) => `${g.name}${g.temp != null ? ` · ${g.temp}°C` : ""}`)
              .join("  |  ")}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hist} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <defs>
                  {gpus.map((_, i) => (
                    <linearGradient key={i} id={`gpuFill${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GPU_UTIL_COLORS[i % GPU_UTIL_COLORS.length]} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={GPU_UTIL_COLORS[i % GPU_UTIL_COLORS.length]} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} vertical={false} />
                <XAxis dataKey="t" {...axisProps} minTickGap={48} />
                <YAxis domain={[0, 100]} {...axisProps} width={40} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#94a3b8" }} />
                {gpus.map((g, i) => (
                  <Area
                    key={`util${i}`}
                    type="monotone"
                    dataKey={`g${i}`}
                    name={`${g.name} util %`}
                    stroke={GPU_UTIL_COLORS[i % GPU_UTIL_COLORS.length]}
                    strokeWidth={2}
                    fill={`url(#gpuFill${i})`}
                    isAnimationActive={false}
                    dot={false}
                  />
                ))}
                {gpus.map((g, i) => (
                  <Line
                    key={`vram${i}`}
                    type="monotone"
                    dataKey={`v${i}`}
                    name={`${g.name} VRAM %`}
                    stroke={GPU_VRAM_COLORS[i % GPU_VRAM_COLORS.length]}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    isAnimationActive={false}
                    dot={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Detail Split Ledger Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Network Endpoint IO Table Grid */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
          <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-2 text-slate-400">
            <Network className="w-4 h-4 text-orange-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Network Adapters & Throughput</h3>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-900/60 border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="text-left font-semibold text-slate-400 px-4 py-2.5 text-xs uppercase tracking-wider">Interface Mapping</th>
                  <th className="text-right font-semibold text-slate-400 px-4 py-2.5 text-xs uppercase tracking-wider">RX Bytes Downstream</th>
                  <th className="text-right font-semibold text-slate-400 px-4 py-2.5 text-xs uppercase tracking-wider">TX Bytes Upstream</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {(info.network || []).map((iface) => (
                  <tr key={iface.interface} className="hover:bg-slate-800/20 transition">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-200">{iface.interface}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-slate-400">{iface.rx}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-slate-400">{iface.tx}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Metric Panel Grouping */}
        <div className="space-y-4">
          {/* Active TTY Profiles */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-2">
              <Users className="w-4 h-4 text-orange-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Logged In Accounts</h3>
            </div>
            <div className="space-y-2 max-h-[120px] overflow-y-auto divide-y divide-slate-800/30 pr-1">
              {(info.loggedInUsers || []).length > 0 ? (
                (info.loggedInUsers || []).map((u, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-mono pt-1.5 first:pt-0">
                    <span className="font-semibold text-slate-200 inline-flex items-center gap-1">
                      <Terminal className="w-3 h-3 text-slate-600" /> {u.user}
                    </span>
                    <span className="text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900 text-[10px]">{u.tty}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-600 italic py-2">Zero active pipeline descriptors attached.</p>
              )}
            </div>
          </div>

          {/* Core Hardware Temperatures */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-2">
              <Thermometer className="w-4 h-4 text-orange-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Thermal Boundary Zones</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1">
              {(info.temperatures || []).map((temp, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-slate-950/60 border border-slate-900/80 p-2 rounded-lg font-mono">
                  <span className="text-slate-500 text-[10px]">Zone {i + 1}</span>
                  <span className="font-bold text-orange-400">{temp}°C</span>
                </div>
              ))}
            </div>
          </div>

          {/* Virtual SWAP Allocations */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-2">
              <Server className="w-4 h-4 text-orange-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Virtual SWAP Cache</h3>
            </div>
            <div className="flex items-center justify-between text-xs font-mono bg-slate-950/40 border border-slate-900 p-2.5 rounded-lg">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Used Capacity</span>
              <span className="text-slate-300 font-semibold">
                {info.swap.used} <span className="text-slate-600 font-normal">/ {info.swap.total} MB</span>
              </span>
            </div>
          </div>

          {/* Process Count */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800 pb-2">
              <ActivitySquare className="w-4 h-4 text-orange-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Runtime Threads</h3>
            </div>
            <div className="flex items-center justify-between text-xs font-mono bg-slate-950/40 border border-slate-900 p-2.5 rounded-lg">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Orchestrated Processes</span>
              <span className="text-slate-300 font-semibold">{displayData.processCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subvalue,
  percentage,
  barColor = "bg-orange-500",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subvalue?: string;
  percentage?: number;
  barColor?: string;
}) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-bold tracking-tight text-white font-mono">{value}</h3>
        {subvalue && <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{subvalue}</p>}
      </div>
      {percentage !== undefined && (
        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
          <div 
            className={`h-full ${barColor} transition-all duration-500 rounded-full`} 
            style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
