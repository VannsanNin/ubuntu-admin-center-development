
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  GitBranch,
  Terminal,
  FileCode,
  PlusCircle,
  Play,
  Download,
  Database
} from "lucide-react";
import { TerminalOutput, ActionButton } from "./shared";

/* ================= REPOSITORIES MODULE ================= */
export function RepositoriesModule() {
  const [repos, setRepos] = useState<any[]>([]);
  const [repoLine, setRepoLine] = useState("");
  const [filename, setFilename] = useState("custom");
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await api.get("/system/repositories");
      setRepos(res.data.repositories || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const handleAction = async (action: string) => {
    setLoading(true);
    try {
      const res = await api.post("/system/repositories", { action, repo: repoLine, filename });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      if (action !== "backup") fetchRepos();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Error adjusting upstream definitions.");
    }
    setLoading(false);
  };

  const handleToggle = async (repo: any) => {
    setLoading(true);
    try {
      const res = await api.post("/system/repositories", {
        action: "toggle",
        source: repo.source,
        line: repo.line,
        enable: !repo.enabled,
      });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchRepos();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Error modifying mirror state.");
    }
    setLoading(false);
  };

  const handleTest = async (repo: any) => {
    setLoading(true);
    try {
      const res = await api.post("/system/repositories", {
        action: "test",
        repo: repo.clean_line || repo.line,
      });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Upstream testing sequence failed.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <GitBranch className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Repository Target Manager</h2>
            <p className="text-xs text-slate-400 mt-0.5">Maintain system APT package lists, custom PPAs, and distribution mirrors</p>
          </div>
        </div>

        <div>
          <button
            onClick={() => handleAction("backup")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold rounded-lg text-slate-300 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Backup sources.list
          </button>
        </div>
      </div>

      {/* Control Map Fields Card */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-4 backdrop-blur-sm">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <PlusCircle className="w-3.5 h-3.5 text-orange-500" />
            Append Distribution Mirror
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative flex items-center md:col-span-2">
            <span className="text-xs font-mono font-bold text-slate-600 absolute left-3 pointer-events-none">MIRROR</span>
            <input
              value={repoLine}
              onChange={(e) => setRepoLine(e.target.value)}
              placeholder="deb http://archive.ubuntu.com/ubuntu noble main restricted"
              className="w-full pl-18 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm font-mono transition outline-none placeholder:text-slate-700"
            />
          </div>
          <div className="relative flex items-center">
            <FileCode className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Target Identifier (e.g. custom)"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800/60 pt-3">
          <ActionButton onClick={() => handleAction("add")}>
            Register Endpoint
          </ActionButton>
          <ActionButton onClick={() => handleAction("remove")} variant="danger">
            Purge Mirror Definition
          </ActionButton>
        </div>
      </div>

      {/* Dynamic Terminal Output Module */}
      {(command || output || loading) && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
          <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">Repository Sync Console Terminal</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}

      {/* Repositories Registry Sheet */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Upstream Package Registries</h3>
          </div>
          <span className="text-xs font-medium text-slate-500">{repos.length} lines processed</span>
        </div>

        <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-28">Status State</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-48">Source Manifest Location</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Mirror Execution Directives</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {repos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-sm text-slate-500 font-medium">
                    No software mirror sources discovered inside target architecture.
                  </td>
                </tr>
              ) : (
                repos.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition group">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button
                        onClick={() => handleToggle(r)}
                        className={`px-2 py-0.5 rounded text-[11px] border font-mono font-bold tracking-tight transition ${
                          r.enabled
                            ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
                            : "bg-slate-950/40 border-slate-800 text-slate-500 hover:text-slate-400 hover:bg-slate-800/30"
                        }`}
                      >
                        {r.enabled ? "ACTIVE" : "DISABLED"}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono truncate max-w-[180px]" title={r.source}>
                      <span className="inline-flex items-center gap-1.5">
                        <Database className="w-3 h-3 text-slate-600" />
                        {r.source?.split("/").pop()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-300 truncate max-w-xs md:max-w-xl" title={r.line}>
                      {r.line}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleTest(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-orange-400 font-medium font-sans text-xs rounded border border-slate-800 hover:border-orange-500/30 transition shadow-sm"
                      >
                        <Play className="w-2.5 h-2.5 text-orange-500" />
                        Test Link
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}