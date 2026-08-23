
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { TauriStream } from "@/lib/streams";
import {
  Server,
  Loader2,
  Search,
  Package,
  Layers,
  Terminal,
  RefreshCw,
  Trash2,
  ArrowUpCircle,
  X
} from "lucide-react";
import { TerminalOutput, ActionButton } from "./shared";

/* ================= PACKAGES MODULE ================= */
export function PackagesModule() {
  const [packages, setPackages] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [pkgName, setPkgName] = useState("");
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"installed" | "search">("installed");

  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [pkgDetails, setPkgDetails] = useState<string>("");
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchInstalled = useCallback(async () => {
    try {
      const res = await api.get("/system/packages?action=installed");
      setPackages(res.data.packages || []);
      setTab("installed");
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    try {
      const res = await api.get(`/system/packages?action=search&query=${search}`);
      setPackages(res.data.packages || []);
      setTab("search");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAction = (actionType: string, name?: string) => {
    const target = name || pkgName;
    if (!target && actionType !== "update" && actionType !== "upgrade" && actionType !== "autoremove") return;

    let cmdStr = "";
    switch (actionType) {
      case "update":
        cmdStr = "sudo apt update";
        break;
      case "install":
        cmdStr = `sudo apt install -y ${target}`;
        break;
      case "remove":
        cmdStr = `sudo apt remove -y ${target}`;
        break;
      case "purge":
        cmdStr = `sudo apt purge -y ${target}`;
        break;
      case "upgrade":
        cmdStr = "sudo apt upgrade -y";
        break;
      case "autoremove":
        cmdStr = "sudo apt autoremove -y";
        break;
      default:
        return;
    }

    setLoading(true);
    setCommand(cmdStr);
    setOutput("");

    // Command output streams over the Tauri event bridge
    // (replaces /api/system/commands/ws).
    const ws = new TauriStream("command");

    ws.onopen = () => {
      ws.send(JSON.stringify({ command: cmdStr }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "stdout" || data.type === "stderr") {
          setOutput((prev) => prev + data.data);
        } else if (data.type === "exit") {
          setLoading(false);
          ws.close();
          fetchInstalled();
        } else if (data.type === "error") {
          setOutput((prev) => prev + "\nError: " + data.message);
          setLoading(false);
          ws.close();
        }
      } catch (err) {
        console.error(err);
      }
    };

    ws.onerror = () => {
      setOutput((prev) => prev + "\nConnection error.");
      setLoading(false);
    };
  };

  const viewPackageDetails = async (pkg: any) => {
    setSelectedPkg(pkg);
    setDetailsLoading(true);
    setPkgDetails("");
    try {
      const res = await api.get(`/system/packages?action=show&query=${pkg.name}`);
      setPkgDetails(res.data.info);
    } catch (err) {
      setPkgDetails("Failed to fetch details.");
    }
    setDetailsLoading(false);
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Package Manager</h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage APT software packages and system repositories</p>
          </div>
        </div>

        {/* Global Operations */}
        <div className="flex flex-wrap gap-2 bg-slate-900/60 p-1.5 border border-slate-800/80 rounded-xl">
          <ActionButton onClick={() => handleAction("update")}>
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <RefreshCw className="w-3.5 h-3.5" /> Update Lists
            </span>
          </ActionButton>
          <ActionButton onClick={() => handleAction("upgrade")}>
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <ArrowUpCircle className="w-3.5 h-3.5" /> Upgrade All
            </span>
          </ActionButton>
          <ActionButton onClick={() => handleAction("autoremove")}>
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Trash2 className="w-3.5 h-3.5" /> Autoremove
            </span>
          </ActionButton>
        </div>
      </div>

      {/* Control Panel: Search & Specific Targets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Search Input Group */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between gap-3 backdrop-blur-sm">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">Repository Search</label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search packages globally..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <ActionButton onClick={fetchInstalled} variant="secondary">
              <span className="flex items-center gap-1 text-xs">
                <Layers className="w-3.5 h-3.5" /> Show Installed
              </span>
            </ActionButton>
            <ActionButton onClick={handleSearch}>Search APT</ActionButton>
          </div>
        </div>

        {/* Targeted Action Input Group */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between gap-3 backdrop-blur-sm">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">Specific Packages</label>
            <div className="relative flex items-center">
              <Package className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <input
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                placeholder="Enter exact package name (e.g. nginx)..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <ActionButton onClick={() => handleAction("remove")} variant="danger">
              Remove
            </ActionButton>
            <ActionButton onClick={() => handleAction("install")}>
              Install Package
            </ActionButton>
          </div>
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Query View: <span className="text-orange-400 normal-case ml-1">{tab === "installed" ? "Installed Packages" : `Search query matches`}</span>
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-500">{packages.length > 100 ? "Showing top 100 entries" : `${packages.length} entries matching`}</span>
        </div>

        <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Package Identifier</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Version</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Description</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {packages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-sm text-slate-500 font-medium">
                    No active entries captured. Perform a search query or inspect system layers.
                  </td>
                </tr>
              ) : (
                packages.slice(0, 100).map((pkg, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition group">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-200 group-hover:text-orange-400 transition">
                      {pkg.name}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                      {pkg.version || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 max-w-xs md:max-w-md truncate">
                      {pkg.description || <span className="text-slate-600 italic">No description listed</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() => viewPackageDetails(pkg)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium rounded-md text-slate-300 shadow-sm transition"
                        >
                          Details
                        </button>
                        {tab === "installed" ? (
                          <button
                            onClick={() => handleAction("remove", pkg.name)}
                            className="px-2.5 py-1 bg-red-950/30 hover:bg-red-900/40 border border-red-900/40 text-xs font-medium rounded-md text-red-400 shadow-inner transition"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction("install", pkg.name)}
                            className="px-2.5 py-1 bg-orange-950/40 hover:bg-orange-900/40 border border-orange-900/50 text-xs font-medium rounded-md text-orange-400 shadow-inner transition"
                          >
                            Install
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package Details Modal Overlay */}
      {selectedPkg && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-start gap-4">
              <div className="space-y-0.5">
                <h3 className="text-lg font-bold text-orange-500 font-mono tracking-tight">{selectedPkg.name}</h3>
                <p className="text-xs text-slate-400 font-mono">Build Version: {selectedPkg.version || "N/A"}</p>
              </div>
              <button
                onClick={() => setSelectedPkg(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Output Frame */}
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-slate-300 whitespace-pre-wrap bg-slate-950 rounded-b-2xl leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                  <span className="text-xs text-slate-500 font-sans tracking-wide">Fetching metadata block...</span>
                </div>
              ) : (
                pkgDetails || "No further details fetched available for this target structural descriptor."
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
