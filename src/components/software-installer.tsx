
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import * as Progress from "@radix-ui/react-progress";
import {
  Sparkles,
  Terminal,
  Download,
  Trash2,
  Code,
  Film,
  FileText,
  Globe,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { TerminalOutput, ActionButton } from "./shared";

interface SoftwareItem {
  id: string;
  name: string;
  packageName: string;
  description: string;
  category: string;
}

const SOFTWARE_CATALOG: SoftwareItem[] = [
  { id: "docker", name: "Docker", packageName: "docker.io", description: "Container platform for building and running applications", category: "Development" },
  { id: "git", name: "Git", packageName: "git", description: "Distributed version control system", category: "Development" },
  { id: "nodejs", name: "Node.js", packageName: "nodejs", description: "JavaScript runtime built on V8 engine", category: "Development" },
  { id: "python3", name: "Python", packageName: "python3", description: "Python programming language", category: "Development" },
  { id: "build-essential", name: "Build Essential", packageName: "build-essential", description: "Essential build tools (gcc, make, etc.)", category: "Development" },
  { id: "maven", name: "Maven", packageName: "maven", description: "Java project build and dependency management tool", category: "Development" },
  { id: "vlc", name: "VLC Media Player", packageName: "vlc", description: "Versatile multimedia player", category: "Multimedia" },
  { id: "gimp", name: "GIMP", packageName: "gimp", description: "GNU Image Manipulation Program", category: "Multimedia" },
  { id: "audacity", name: "Audacity", packageName: "audacity", description: "Multi-track audio editor and recorder", category: "Multimedia" },
  { id: "obs", name: "OBS Studio", packageName: "obs-studio", description: "Open Broadcaster Software for recording/streaming", category: "Multimedia" },
  { id: "ffmpeg", name: "FFmpeg", packageName: "ffmpeg", description: "Audio/video recording, conversion and streaming toolkit", category: "Multimedia" },
  { id: "inkscape", name: "Inkscape", packageName: "inkscape", description: "Vector graphics editor similar to Illustrator", category: "Multimedia" },
  { id: "libreoffice", name: "LibreOffice", packageName: "libreoffice", description: "Full office productivity suite", category: "Office" },
  { id: "thunderbird", name: "Thunderbird", packageName: "thunderbird", description: "Email, calendar and chat client", category: "Office" },
  { id: "pdfarranger", name: "PDF Arranger", packageName: "pdfarranger", description: "PDF merging, splitting and reordering tool", category: "Office" },
  { id: "nginx", name: "Nginx", packageName: "nginx", description: "High-performance web server and reverse proxy", category: "Networking" },
  { id: "mysql", name: "MySQL Server", packageName: "mysql-server", description: "Popular relational database management system", category: "Networking" },
  { id: "postgresql", name: "PostgreSQL", packageName: "postgresql", description: "Advanced open-source relational database", category: "Networking" },
  { id: "redis", name: "Redis", packageName: "redis", description: "In-memory data structure store (cache/database)", category: "Networking" },
  { id: "mosquitto", name: "Mosquitto", packageName: "mosquitto", description: "MQTT message broker for IoT", category: "Networking" },
  { id: "wireguard", name: "WireGuard", packageName: "wireguard", description: "Modern and secure VPN tunnel", category: "Networking" },
  { id: "openvpn", name: "OpenVPN", packageName: "openvpn", description: "Open-source VPN solution", category: "Networking" },
  { id: "curl", name: "Curl", packageName: "curl", description: "Command-line tool for transferring data with URLs", category: "Networking" },
  { id: "wget", name: "Wget", packageName: "wget", description: "Internet file retriever for downloading files", category: "Networking" },
  { id: "clamav", name: "ClamAV", packageName: "clamav", description: "Open-source antivirus engine", category: "Security" },
  { id: "fail2ban", name: "Fail2Ban", packageName: "fail2ban", description: "Intrusion prevention framework", category: "Security" },
  { id: "rkhunter", name: "Rkhunter", packageName: "rkhunter", description: "Rootkit hunter scanner", category: "Security" },
  { id: "tripwire", name: "Tripwire", packageName: "tripwire", description: "File integrity monitoring tool", category: "Security" },
  { id: "gnupg", name: "GnuPG", packageName: "gnupg", description: "GNU Privacy Guard encryption tool", category: "Security" },
];

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string }> = {
  Development: { icon: <Code className="w-5 h-5" />, color: "text-blue-400" },
  Multimedia: { icon: <Film className="w-5 h-5" />, color: "text-purple-400" },
  Office: { icon: <FileText className="w-5 h-5" />, color: "text-green-400" },
  Networking: { icon: <Globe className="w-5 h-5" />, color: "text-cyan-400" },
  Security: { icon: <Shield className="w-5 h-5" />, color: "text-rose-400" },
};

const categories = [...new Set(SOFTWARE_CATALOG.map((s) => s.category))];

export function SoftwareInstallerModule() {
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [progress, setProgress] = useState(0);
  const [showCommand, setShowCommand] = useState(true);
  const [mode, setMode] = useState<"install" | "uninstall">("install");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(categories));

  const checkInstalled = useCallback(async () => {
    const allPkgs = SOFTWARE_CATALOG.map((s) => s.packageName);
    try {
      const res = await api.post("/system/software-installer/check", { packages: allPkgs });
      setInstalled(res.data.status || {});
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    checkInstalled();
  }, [checkInstalled]);

  const toggleItem = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const getSelectedPackages = useCallback(() => {
    return SOFTWARE_CATALOG
      .filter((s) => {
        if (!selected.has(s.id)) return false;
        return mode === "install" ? !installed[s.packageName] : installed[s.packageName];
      })
      .map((s) => s.packageName);
  }, [selected, installed, mode]);

  const getCommandString = useCallback(() => {
    const pkgs = getSelectedPackages();
    if (pkgs.length === 0) return "";
    const pkgStr = pkgs.join(" ");
    return mode === "install"
      ? `sudo apt-get install -y ${pkgStr}`
      : `sudo apt-get remove -y ${pkgStr}`;
  }, [getSelectedPackages, mode]);

  const handleExecute = async () => {
    const pkgs = getSelectedPackages();
    if (pkgs.length === 0) return;

    const cmdStr = getCommandString();
    setCommand(cmdStr);
    setOutput("");
    setProgress(30);
    setLoading(true);

    try {
      const res = await api.post("/system/software-installer", {
        action: mode,
        packages: pkgs,
      });
      setProgress(100);
      const out = res.data.stdout || "";
      const err = res.data.stderr || "";
      setOutput(out + (err ? `\n${err}` : ""));
      if (res.data.exitCode !== 0) {
        setOutput((prev) => prev + `\n\nExit code: ${res.data.exitCode}`);
      }
      await checkInstalled();
    } catch (err) {
      setOutput("Error: " + String((err as any)?.response?.data?.detail || (err as any)?.response?.data?.error || err));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "install" ? "uninstall" : "install"));
    setSelected(new Set());
    setOutput("");
    setCommand("");
    setProgress(0);
  };

  const selectAll = () => {
    const all = new Set<string>();
    SOFTWARE_CATALOG.forEach((s) => {
      const isInst = installed[s.packageName];
      if (mode === "install" && !isInst) all.add(s.id);
      else if (mode === "uninstall" && isInst) all.add(s.id);
    });
    setSelected(all);
  };

  const toggleCategory = (cat: string) => {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCategories(next);
  };

  const countByCategory = (cat: string) => {
    const items = SOFTWARE_CATALOG.filter((s) => s.category === cat);
    const installedCount = items.filter((s) => installed[s.packageName]).length;
    return { total: items.length, installed: installedCount };
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">Software Installer</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-full">
                Highly Recommended
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">One-click install of common Ubuntu software packages</p>
          </div>
        </div>

        <div className="flex gap-2">
          <ActionButton onClick={checkInstalled} variant="secondary">
            <RefreshCw className="w-3.5 h-3.5" />
          </ActionButton>
          <ActionButton onClick={toggleMode} variant="secondary">
            {mode === "install" ? "Switch to Uninstall" : "Switch to Install"}
          </ActionButton>
          <ActionButton onClick={selectAll}>
            Select All
          </ActionButton>
        </div>
      </div>

      {/* Mode banner */}
      <div className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
        mode === "install"
          ? "bg-emerald-900/20 border border-emerald-800/30 text-emerald-400"
          : "bg-red-900/20 border border-red-800/30 text-red-400"
      }`}>
        {mode === "install" ? (
          <><Download className="w-4 h-4" /> Select software to install on your system</>
        ) : (
          <><Trash2 className="w-4 h-4" /> Select installed software to remove from your system</>
        )}
      </div>

      {/* Software Catalog */}
      <div className="space-y-3">
        {categories.map((category) => {
          const items = SOFTWARE_CATALOG.filter((s) => s.category === category);
          const { total, installed: catInstalled } = countByCategory(category);
          const expanded = expandedCategories.has(category);
          const meta = CATEGORY_META[category];
          const catSelected = items.filter((s) => selected.has(s.id)).length;

          return (
            <div key={category} className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-sm">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center gap-2 hover:bg-slate-800/30 transition-colors"
              >
                <span className={meta.color}>{meta.icon}</span>
                <h3 className="text-sm font-bold uppercase tracking-wider">{category}</h3>
                <span className="text-xs text-slate-500 ml-2">
                  {catInstalled}/{total} installed
                </span>
                {catSelected > 0 && (
                  <span className="text-xs font-medium text-orange-400 ml-1">
                    ({catSelected} selected)
                  </span>
                )}
                <span className="ml-auto text-slate-600">
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
              </button>

              {expanded && (
                <div className="p-1">
                  {items.map((item) => {
                    const isInstalled = installed[item.packageName];
                    const isSelected = selected.has(item.id);
                    const disabled = mode === "install" ? isInstalled : !isInstalled;

                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-orange-500/10 border border-orange-500/20"
                            : "hover:bg-slate-800/40 border border-transparent"
                        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => toggleItem(item.id)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 disabled:opacity-50"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">{item.name}</span>
                            {isInstalled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-800/30">
                                <CheckCircle2 className="w-3 h-3" />
                                Installed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-500 border border-slate-700">
                                <XCircle className="w-3 h-3" />
                                Not installed
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
                        </div>
                        <code className="text-[10px] font-mono text-slate-600 bg-slate-950 px-2 py-1 rounded border border-slate-800 hidden lg:block shrink-0">
                          {item.packageName}
                        </code>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-300">
              {selected.size} package{selected.size !== 1 ? "s" : ""} selected
            </span>
            <span className="text-xs text-slate-500">
              for {mode === "install" ? "installation" : "removal"}
            </span>
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
          {mode === "install" ? (
            <ActionButton onClick={handleExecute} disabled={loading || getSelectedPackages().length === 0}>
              <span className="flex items-center gap-1.5 text-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Install Selected
              </span>
            </ActionButton>
          ) : (
            <ActionButton onClick={handleExecute} disabled={loading || getSelectedPackages().length === 0} variant="danger">
              <span className="flex items-center gap-1.5 text-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Uninstall Selected
              </span>
            </ActionButton>
          )}
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
            <span className="text-xs font-mono font-medium">Live Output Console</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}
    </div>
  );
}
