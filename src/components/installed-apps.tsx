
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
} from "lucide-react";

const normalizeSearch = (value: unknown, collapseRepeats = false) => {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

  return collapseRepeats
    ? normalized.replace(/([\p{L}\p{N}])\1+/gu, "$1")
    : normalized;
};

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
    const rawSearch = search.trim();
    const collapseRepeats = rawSearch.length >= 4;
    const q = normalizeSearch(rawSearch, collapseRepeats);
    setFiltered(
      packages.filter((p) =>
        [p.name, p.description, p.search_text].some((value) =>
          normalizeSearch(value, collapseRepeats).includes(q)
        )
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
      const succeeded = res.data.exit_code === 0;
      const stdout = res.data.stdout?.trim() || "";
      const stderr = res.data.stderr?.trim() || "";
      await fetchInstalled();
      setResult({
        name: pkg.name,
        ok: succeeded,
        msg: (succeeded ? stdout : stderr) || stdout || stderr || "Done",
      });
    } catch (err: any) {
      setResult({
        name: pkg.name,
        ok: false,
        msg: err.response?.data?.detail || err.message || "Uninstall failed",
      });
    } finally {
      setUninstalling(null);
    }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="uninstall-confirm-title"
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
              <div className="p-2 bg-red-900/40 border border-red-700/40 rounded-lg text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="uninstall-confirm-title" className="text-base font-bold text-slate-100">Uninstall Package</h3>
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

      {(uninstalling || result) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="uninstall-status-title"
            aria-live="polite"
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="px-6 py-6 text-center">
              <div
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border ${
                  uninstalling
                    ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                    : result?.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                }`}
              >
                {uninstalling ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : result?.ok ? (
                  <ShieldCheck className="h-7 w-7" />
                ) : (
                  <ShieldAlert className="h-7 w-7" />
                )}
              </div>

              <h3 id="uninstall-status-title" className="text-lg font-bold text-slate-100">
                {uninstalling
                  ? "Uninstalling package"
                  : result?.ok
                    ? "Uninstall complete"
                    : "Uninstall failed"}
              </h3>

              {uninstalling ? (
                <>
                  <p className="mt-2 font-mono text-sm font-medium text-orange-400">{uninstalling}</p>
                  <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
                    APT is removing the package and updating the system database. Keep this window open.
                  </p>
                  <div className="mx-auto mt-5 h-1 w-32 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-transparent via-orange-400 to-transparent" />
                  </div>
                </>
              ) : result ? (
                <>
                  <p className="mt-2 font-mono text-sm font-medium text-slate-200">{result.name}</p>
                  <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
                    {result.ok
                      ? "The package was removed successfully."
                      : "The package could not be removed. Review the details below and try again."}
                  </p>
                </>
              ) : null}
            </div>

            {result?.msg && (
              <details className="mx-6 mb-5 overflow-hidden rounded-lg border border-slate-700/70 bg-slate-950/60 text-left">
                <summary className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-slate-400 transition hover:text-slate-200">
                  Package manager output
                </summary>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words border-t border-slate-800 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-400">
                  {result.msg}
                </pre>
              </details>
            )}

            {!uninstalling && (
              <div className="flex justify-end border-t border-slate-800 bg-slate-950/50 px-6 py-4">
                <button
                  onClick={() => setResult(null)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
