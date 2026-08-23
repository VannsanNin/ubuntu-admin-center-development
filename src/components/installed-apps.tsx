
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  AppWindow,
  Loader2,
  Search,
  RefreshCw,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

export function InstalledAppsModule() {
  const [packages, setPackages] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [confirmPkg, setConfirmPkg] = useState<any | null>(null);
  const [result, setResult] = useState<{name: string; ok: boolean; msg: string} | null>(null);

  const fetchInstalled = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/system/packages?action=installed");
      const pkgs = res.data.packages || [];
      setPackages(pkgs);
      setFiltered(pkgs);
    } catch {
      setPackages([]);
      setFiltered([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      packages.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      )
    );
  }, [search, packages]);

  const handleUninstall = async (pkg: any) => {
    setUninstalling(pkg.name);
    setConfirmPkg(null);
    setResult(null);
    try {
      const res = await api.post("/system/packages", {
        action: "remove",
        package_name: pkg.name,
      });
      setResult({
        name: pkg.name,
        ok: res.data.exit_code === 0,
        msg: res.data.stdout?.trim() || res.data.stderr?.trim() || "Done",
      });
      fetchInstalled();
    } catch (err: any) {
      setResult({
        name: pkg.name,
        ok: false,
        msg: err.response?.data?.detail || err.message || "Uninstall failed",
      });
    }
    setUninstalling(null);
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-full mx-auto p-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <AppWindow className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Installed Apps</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? "Loading..." : `${packages.length} packages installed`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search installed apps..."
              className="w-64 pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={fetchInstalled}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {result && (
        <div className={`px-4 py-3 rounded-lg border text-sm flex items-start gap-3 ${
          result.ok
            ? "bg-emerald-900/30 border-emerald-700/40 text-emerald-300"
            : "bg-red-900/30 border-red-700/40 text-red-300"
        }`}>
          <div className="mt-0.5 shrink-0">
            {result.ok ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{result.ok ? "Uninstalled" : "Failed"}: {result.name}</p>
            <p className="text-xs mt-0.5 opacity-80 break-words">{result.msg}</p>
          </div>
          <button onClick={() => setResult(null)} className="shrink-0 opacity-60 hover:opacity-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            All Packages
          </h3>
          <span className="text-xs font-medium text-slate-500">
            {filtered.length} of {packages.length}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Name</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Version</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Arch</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Description</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-slate-500 font-medium">
                    {search ? "No packages match your search." : "No packages found."}
                  </td>
                </tr>
              ) : (
                filtered.map((pkg, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition group">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-200 group-hover:text-orange-400 transition">
                      {pkg.name}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                      {pkg.version || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">
                      {pkg.architecture || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 max-w-md truncate">
                      {pkg.description || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {pkg.safe_to_remove ? (
                        <button
                          onClick={() => setConfirmPkg(pkg)}
                          disabled={uninstalling === pkg.name}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-900/40 hover:bg-red-800/60 border border-red-700/40 hover:border-red-600/60 rounded-lg text-red-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {uninstalling === pkg.name ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Uninstall
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 cursor-not-allowed" title="System-critical package — cannot uninstall">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Protected
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
              <div className="p-2 bg-red-900/40 border border-red-700/40 rounded-lg text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Uninstall Package</h3>
                <p className="text-xs text-slate-400 mt-0.5">This action will remove the package from your system.</p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Package:</span>
                <span className="font-mono font-medium text-orange-400">{confirmPkg.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Version:</span>
                <span className="font-mono text-slate-300">{confirmPkg.version || "-"}</span>
              </div>
              {confirmPkg.description && confirmPkg.description !== "-" && (
                <p className="text-xs text-slate-500 pt-1">{confirmPkg.description}</p>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setConfirmPkg(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUninstall(confirmPkg)}
                disabled={uninstalling === confirmPkg.name}
                className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-600 border border-red-600 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {uninstalling === confirmPkg.name ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Uninstall
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
