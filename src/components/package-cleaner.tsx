
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import * as Progress from "@radix-ui/react-progress";
import {
  Trash2,
  Terminal,
  Loader2,
  RefreshCw,
  HardDrive,
  Package,
  Archive,
  Cpu,
  Database,
} from "lucide-react";
import { TerminalOutput, ActionButton } from "./shared";

interface AnalysisData {
  cacheSize: string;
  disk: { total: string; used: string; percent: string };
  orphans: { count: number; packages: string[] };
  oldKernels: { count: number; kernels: string[]; current: string };
  autocleanCount: number;
}

interface CleanOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  analyzeKey?: keyof AnalysisData;
}

const CLEAN_OPTIONS: CleanOption[] = [
  {
    id: "autoremove",
    label: "Remove orphan packages",
    description: "Remove packages that were automatically installed and are no longer needed",
    icon: <Package className="w-4 h-4" />,
  },
  {
    id: "clean",
    label: "Clean APT cache",
    description: "Remove all .deb package files from /var/cache/apt/archives/",
    icon: <Archive className="w-4 h-4" />,
  },
  {
    id: "autoclean",
    label: "Remove outdated cache",
    description: "Remove obsolete .deb package files that can no longer be downloaded",
    icon: <Database className="w-4 h-4" />,
  },
  {
    id: "old-kernels",
    label: "Remove old kernels",
    description: "Remove old Linux kernel images (keeps current running kernel)",
    icon: <Cpu className="w-4 h-4" />,
  },
];

export function PackageCleanerModule() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [progress, setProgress] = useState(0);
  const [showCommand, setShowCommand] = useState(true);

  const fetchAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const res = await api.get("/system/package-cleaner/analyze");
      setAnalysis(res.data);
    } catch (err) {
      console.error(err);
    }
    setAnalyzing(false);
  }, []);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const toggleItem = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const getCommandString = useCallback(() => {
    const actions = CLEAN_OPTIONS.filter((o) => selected.has(o.id)).map((o) => o.id);
    const cmdMap: Record<string, string> = {
      autoremove: "sudo apt-get autoremove -y",
      clean: "sudo apt-get clean",
      autoclean: "sudo apt-get autoclean -y",
      "old-kernels": "sudo apt-get autoremove --purge -y",
    };
    return actions.map((a) => cmdMap[a]).join(" && ");
  }, [selected]);

  const handleExecute = async () => {
    const actions = CLEAN_OPTIONS.filter((o) => selected.has(o.id)).map((o) => o.id);
    if (actions.length === 0) return;

    const cmdStr = getCommandString();
    setCommand(cmdStr);
    setOutput("");
    setProgress(30);
    setLoading(true);

    try {
      const res = await api.post("/system/package-cleaner/clean", { actions });
      setProgress(100);
      const out = res.data.stdout || "";
      const err = res.data.stderr || "";
      setOutput(out + (err ? `\n${err}` : ""));
      if (res.data.exitCode !== 0) {
        setOutput((prev) => prev + `\n\nExit code: ${res.data.exitCode}`);
      }
      await fetchAnalysis();
    } catch (err) {
      setOutput("Error: " + ((err as any)?.response?.data?.detail || (err as any)?.response?.data?.error || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const selectAll = () => {
    const hasItems =
      (analysis?.orphans.count ?? 0) > 0 ||
      (analysis?.oldKernels.count ?? 0) > 0 ||
      (analysis?.autocleanCount ?? 0) > 0;
    if (!hasItems) return;
    setSelected(new Set(CLEAN_OPTIONS.map((o) => o.id)));
  };

  const getOptionHint = (option: CleanOption): string | null => {
    if (!analysis) return null;
    switch (option.id) {
      case "autoremove":
        return analysis.orphans.count > 0
          ? `${analysis.orphans.count} package${analysis.orphans.count !== 1 ? "s" : ""} can be removed`
          : "No orphan packages found";
      case "clean":
        return analysis.cacheSize !== "0" ? `${analysis.cacheSize} in cache` : "Cache is empty";
      case "autoclean":
        return analysis.autocleanCount > 0
          ? `${analysis.autocleanCount} outdated package${analysis.autocleanCount !== 1 ? "s" : ""} to remove`
          : "No outdated cache entries";
      case "old-kernels":
        return analysis.oldKernels.count > 0
          ? `${analysis.oldKernels.count} old kernel${analysis.oldKernels.count !== 1 ? "s" : ""} found`
          : `No old kernels (current: ${analysis.oldKernels.current})`;
    }
    return null;
  };

  const isOptionDisabled = (option: CleanOption): boolean => {
    if (!analysis) return true;
    switch (option.id) {
      case "autoremove":
        return analysis.orphans.count === 0;
      case "clean":
        return analysis.cacheSize === "0";
      case "autoclean":
        return analysis.autocleanCount === 0;
      case "old-kernels":
        return analysis.oldKernels.count === 0;
    }
    return false;
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Package Cleaner</h2>
            <p className="text-xs text-slate-400 mt-0.5">Free up disk space by removing unnecessary packages and cache</p>
          </div>
        </div>

        <div className="flex gap-2">
          <ActionButton onClick={fetchAnalysis} variant="secondary" disabled={analyzing}>
            <span className="flex items-center gap-1.5 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? "animate-spin" : ""}`} />
              Analyze
            </span>
          </ActionButton>
          <ActionButton onClick={selectAll} disabled={!analysis || loading}>
            Select All
          </ActionButton>
        </div>
      </div>

      {/* Analysis Dashboard */}
      {analyzing && !analysis && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          <span className="ml-3 text-sm text-slate-400">Analyzing system...</span>
        </div>
      )}

      {analysis && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Archive className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">APT Cache</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{analysis.cacheSize || "0"}</p>
              <p className="text-[10px] text-slate-600 mt-1">.deb packages in cache</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Package className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Orphans</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{analysis.orphans.count}</p>
              <p className="text-[10px] text-slate-600 mt-1">Unnecessary packages</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Cpu className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Old Kernels</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{analysis.oldKernels.count}</p>
              <p className="text-[10px] text-slate-600 mt-1">Kernel: {analysis.oldKernels.current}</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <HardDrive className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Disk Usage</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{analysis.disk.percent || "?"}</p>
              <p className="text-[10px] text-slate-600 mt-1">{analysis.disk.used} / {analysis.disk.total}</p>
            </div>
          </div>

          {/* Cleaning Options */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-sm">
            <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Cleaning Options</h3>
            </div>
            <div className="p-1">
              {CLEAN_OPTIONS.map((option) => {
                const hint = getOptionHint(option);
                const disabled = isOptionDisabled(option);
                const isSelected = selected.has(option.id);

                return (
                  <label
                    key={option.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-orange-500/10 border border-orange-500/20"
                        : "hover:bg-slate-800/40 border border-transparent"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => toggleItem(option.id)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 disabled:opacity-50"
                    />
                    <span className="text-orange-500 shrink-0">{option.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{option.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                    </div>
                    {hint && (
                      <span className={`text-[11px] font-medium shrink-0 ${
                        disabled ? "text-slate-600" : "text-orange-400"
                      }`}>
                        {hint}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Orphan packages detail */}
          {analysis.orphans.count > 0 && analysis.orphans.packages.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Orphan packages to be removed
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {analysis.orphans.packages.slice(0, 30).map((pkg) => (
                  <code key={pkg} className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {pkg}
                  </code>
                ))}
                {analysis.orphans.packages.length > 30 && (
                  <span className="text-[10px] text-slate-600 px-2 py-0.5">
                    +{analysis.orphans.packages.length - 30} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Old kernels detail */}
          {analysis.oldKernels.count > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Old kernel packages
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {analysis.oldKernels.kernels.map((k) => (
                  <code key={k} className="text-[10px] font-mono text-rose-400 bg-rose-950/20 px-2 py-0.5 rounded border border-rose-900/30">
                    {k}
                  </code>
                ))}
                <code className="text-[10px] font-mono text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">
                  {analysis.oldKernels.current} (current)
                </code>
              </div>
            </div>
          )}

          {/* Command Preview & Action Bar */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-300">
                  {selected.size} action{selected.size !== 1 ? "s" : ""} selected
                </span>
                <span className="text-xs text-slate-500">to execute</span>
              </div>
              <button
                onClick={() => setShowCommand(!showCommand)}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
              >
                <Terminal className="w-3 h-3" />
                {showCommand ? "Hide" : "Show"} command
              </button>
            </div>

            {showCommand && getCommandString() && (
              <div className="mb-3 bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Terminal className="w-3 h-3 text-orange-500" />
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Exact command to execute</span>
                </div>
                <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap break-all select-all">{getCommandString()}</pre>
              </div>
            )}

            {loading && (
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress.Root
                  className="relative overflow-hidden bg-slate-800 rounded-full h-2 w-full"
                  value={progress}
                >
                  <Progress.Indicator
                    className="bg-orange-500 h-full w-full rounded-full transition-all duration-700 ease-out"
                    style={{ transform: `translateX(-${100 - progress}%)` }}
                  />
                </Progress.Root>
              </div>
            )}

            <div className="flex gap-2">
              <ActionButton onClick={handleExecute} disabled={loading || selected.size === 0}>
                <span className="flex items-center gap-1.5 text-sm">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Run Cleanup
                </span>
              </ActionButton>
              {selected.size > 0 && (
                <ActionButton onClick={() => setSelected(new Set())} variant="secondary">
                  Clear Selection
                </ActionButton>
              )}
            </div>
          </div>

          {/* Terminal Output */}
          {(command || output) && (
            <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
              <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
                <Terminal className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-mono font-medium">Output Console</span>
              </div>
              <TerminalOutput command={command} output={output} loading={loading} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
