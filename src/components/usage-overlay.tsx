import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ActivitySquare, Cpu, MemoryStick, X } from "lucide-react";
import { useEffect, useState, type ElementType, type MouseEvent } from "react";
import { TauriStream } from "@/lib/streams";

type UsageMetricId = "cpu" | "ram" | "gpu";

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
  gpus?: GpuInfo[];
}

interface MetricView {
  id: UsageMetricId;
  label: string;
  detail: string;
  percentage: number | null;
  color: string;
  icon: ElementType;
}

const USAGE_SELECTION_EVENT = "usage-selection-changed";
const overlayWindow = getCurrentWindow();

function isUsageMetricId(value: unknown): value is UsageMetricId {
  return value === "cpu" || value === "ram" || value === "gpu";
}

function clampPercentage(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.min(Math.max(value, 0), 100);
}

function formatPercentage(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

export default function UsageOverlay() {
  const [selectedMetrics, setSelectedMetrics] = useState<UsageMetricId[]>([]);
  const [streamData, setStreamData] = useState<StreamData | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;

    const initialize = async () => {
      const stopListening = await listen<UsageMetricId[]>(USAGE_SELECTION_EVENT, ({ payload }) => {
        if (Array.isArray(payload)) {
          setSelectedMetrics(payload.filter(isUsageMetricId));
        }
      });

      if (disposed) {
        stopListening();
        return;
      }

      unlisten = stopListening;
      const selection = await invoke<UsageMetricId[]>("get_usage_selection");
      if (!disposed) {
        setSelectedMetrics(selection.filter(isUsageMetricId));
      }
    };

    void initialize().catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const stream = new TauriStream("stats");
    stream.onmessage = ({ data }) => {
      try {
        setStreamData(JSON.parse(data) as StreamData);
      } catch {
        return;
      }
    };

    return () => stream.close();
  }, []);

  const cpuPercentage = clampPercentage(parseFloat(streamData?.cpuUsage ?? ""));
  const memoryPercentage = clampPercentage(streamData?.memory.percentage);
  const gpus = streamData?.gpus ?? [];
  const gpuPercentage = gpus.length
    ? clampPercentage(gpus.reduce((total, gpu) => total + gpu.usage, 0) / gpus.length)
    : null;
  const gpuMemoryPercentage = gpus.length
    ? Math.round(
        gpus.reduce(
          (total, gpu) => total + (gpu.memTotal > 0 ? (gpu.memUsed / gpu.memTotal) * 100 : 0),
          0,
        ) / gpus.length,
      )
    : null;

  const metrics: MetricView[] = [
    {
      id: "cpu",
      label: "CPU",
      detail: streamData?.loadAverage?.length
        ? `Load ${streamData.loadAverage.slice(0, 3).join(" ")}`
        : "Processor load",
      percentage: cpuPercentage,
      color: "#3b82f6",
      icon: Cpu,
    },
    {
      id: "ram",
      label: "RAM",
      detail: streamData?.memory
        ? `${streamData.memory.used} / ${streamData.memory.total}`
        : "Memory usage",
      percentage: memoryPercentage,
      color: "#22c55e",
      icon: MemoryStick,
    },
    {
      id: "gpu",
      label: "GPU",
      detail: gpus.length
        ? `${gpus.length} GPU${gpus.length === 1 ? "" : "s"} · ${gpuMemoryPercentage ?? 0}% VRAM`
        : "No GPU detected",
      percentage: gpuPercentage,
      color: "#ec4899",
      icon: ActivitySquare,
    },
  ];
  const visibleMetrics = metrics.filter(({ id }) => selectedMetrics.includes(id));

  const hideOverlay = () => {
    void invoke("set_usage_overlay_visible", { visible: false }).catch(() => undefined);
  };

  const startDragging = (event: MouseEvent<HTMLElement>) => {
    if (event.buttons !== 1 || (event.target as Element).closest("button")) return;
    event.preventDefault();
    void overlayWindow
      .setFocus()
      .then(() => overlayWindow.startDragging())
      .catch(() => undefined);
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-transparent p-2 text-slate-100">
      <section
        onMouseDown={startDragging}
        className="flex h-full cursor-grab select-none flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-transparent shadow-2xl shadow-black/60 active:cursor-grabbing"
      >
        <header className="flex h-9 shrink-0 items-center justify-between border-b border-slate-800/80 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
              Live usage
            </span>
          </div>
          <button
            type="button"
            onClick={hideOverlay}
            aria-label="Hide usage widget"
            title="Hide usage widget"
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-3 py-2">
          {visibleMetrics.length > 0 ? (
            visibleMetrics.map(({ id, label, detail, percentage, color, icon: Icon }) => (
              <div
                key={id}
                className="grid grid-cols-[20px_76px_minmax(0,1fr)_46px] items-center gap-2"
              >
                <Icon className="h-4 w-4" style={{ color }} />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    {label}
                  </p>
                  <p className="truncate text-[9px] text-slate-500">{detail}</p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${percentage ?? 0}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span className="text-right font-mono text-xs font-semibold text-slate-200">
                  {formatPercentage(percentage)}
                </span>
              </div>
            ))
          ) : (
            <div className="flex flex-1 items-center justify-center px-3 text-center text-[10px] leading-4 text-slate-500">
              Select CPU, RAM, or GPU from the dashboard to populate this widget.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
