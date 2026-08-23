
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Archive,
  RotateCcw,
  Trash2,
  Terminal,
  Shield,
  Clock,
  Database,
  Lock,
  Calendar,
  X
} from "lucide-react";
import { TerminalOutput, ActionButton } from "./shared";

/* ================= BACKUPS MODULE ================= */
export function BackupsModule() {
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [sourcePath, setSourcePath] = useState("/etc");
  const [destinationPath, setDestinationPath] = useState("/backups");
  const [compression, setCompression] = useState(true);
  const [encryption, setEncryption] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [schedule, setSchedule] = useState("");
  const [backupType, setBackupType] = useState("folder");
  const [incremental, setIncremental] = useState(false);
  const [dbName, setDbName] = useState("app_db");
  const [sqlitePath, setSqlitePath] = useState("");
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await api.get("/backups");
      setBackupsList(res.data.backups || []);
    } catch (err) {
      console.error("Infrastructure snapshot lookup failure:", err);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const createBackup = async () => {
    setLoading(true);
    try {
      const payload: any = {
        action: "create",
        name,
        sourcePath,
        destinationPath,
        type: backupType,
        compression,
        encryption,
        incremental,
        schedule,
      };
      if (encryption) payload.encryptionPassword = encryptionPassword;
      if (backupType === "postgres") payload.dbName = dbName;
      if (backupType === "sqlite") payload.sqlitePath = sqlitePath || sourcePath;
      
      const res = await api.post("/backups", payload);
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchBackups();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Backup runtime execution fault");
    }
    setLoading(false);
  };

  const restoreBackup = async (id: number) => {
    setLoading(true);
    try {
      const payload: any = { action: "restore", backupId: id };
      if (restorePassword) payload.encryptionPassword = restorePassword;
      const res = await api.post("/backups", payload);
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Snapshot target extraction fault");
    }
    setLoading(false);
    setRestoringId(null);
  };

  const deleteBackup = async (id: number) => {
    try {
      await api.post("/backups", { action: "delete", backupId: id });
      fetchBackups();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">System Backup & Recovery</h2>
            <p className="text-xs text-slate-400 mt-0.5">Automate storage snapshots, database dumps, encryption archives, and restoration procedures</p>
          </div>
        </div>
      </div>

      {/* Snapshot Specification Tool Block */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm space-y-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-800 pb-2">
          Configure Archive Target Blueprint
        </span>
        
        {/* Step 1 Rows */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Archive Label Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. nightly_etc_dump"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Source Volume Driver Type</label>
            <div className="relative flex items-center">
              <Database className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
              <select value={backupType} onChange={(e) => setBackupType(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm outline-none appearance-none cursor-pointer text-slate-300">
                <option value="folder">Folder Directory Tree (tar)</option>
                <option value="postgres">PostgreSQL Database Engine</option>
                <option value="sqlite">SQLite Standalone File</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Destination Target Mount</label>
            <input value={destinationPath} onChange={(e) => setDestinationPath(e.target.value)} placeholder="e.g. /mnt/backups"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm font-mono outline-none text-orange-400/90" />
          </div>
        </div>

        {/* Dynamic Context Parameters Field */}
        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
          {backupType === "folder" && (
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Source Target Directory Path</label>
              <input value={sourcePath} onChange={(e) => setSourcePath(e.target.value)} placeholder="e.g. /var/www/html"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm font-mono outline-none" />
            </div>
          )}
          {backupType === "postgres" && (
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">PostgreSQL Target Database Name</label>
              <input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="e.g. core_production_db"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm font-mono outline-none" />
            </div>
          )}
          {backupType === "sqlite" && (
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">SQLite Absolute Storage Endpoint File</label>
              <input value={sqlitePath} onChange={(e) => setSqlitePath(e.target.value)} placeholder="e.g. /var/lib/docker/volumes/db.sqlite"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm font-mono outline-none" />
            </div>
          )}
        </div>

        {/* Structural Compression & Cryptography Modifiers Bar */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-1 text-slate-300">
          <label className="flex items-center gap-2 text-xs select-none cursor-pointer group">
            <input type="checkbox" checked={compression} onChange={(e) => setCompression(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-orange-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5" />
            <span className="group-hover:text-white transition">Gzip Package Compression</span>
          </label>
          
          {backupType === "folder" && (
            <label className="flex items-center gap-2 text-xs select-none cursor-pointer group">
              <input type="checkbox" checked={incremental} onChange={(e) => setIncremental(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-orange-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5" />
              <span className="group-hover:text-white transition">Incremental delta (Scan changes last 24h)</span>
            </label>
          )}

          <label className="flex items-center gap-2 text-xs select-none cursor-pointer group">
            <input type="checkbox" checked={encryption} onChange={(e) => setEncryption(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-orange-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5" />
            <span className="group-hover:text-white transition flex items-center gap-1">
              <Lock className="w-3 h-3 text-yellow-600" /> AES-256 Envelope Encryption
            </span>
          </label>
        </div>

        {/* Conditional Passphrase Layer */}
        {encryption && (
          <div className="relative flex items-center animate-in slide-in-from-top-2 duration-150">
            <Shield className="w-4 h-4 text-yellow-500 absolute left-3 pointer-events-none" />
            <input type="password" value={encryptionPassword} onChange={(e) => setEncryptionPassword(e.target.value)}
              placeholder="Secure symmetric decryption passphrase..." className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm font-mono outline-none" />
          </div>
        )}

        {/* Automation Scheduler Action Execution Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-slate-800/60">
          <div className="relative flex items-center flex-1">
            <Clock className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input value={schedule} onChange={(e) => setSchedule(e.target.value)}
              placeholder="Cron pattern expression (e.g. 0 2 * * * for nightly deployments execution)"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-lg text-xs font-mono transition outline-none placeholder:text-slate-700" />
          </div>
          <ActionButton onClick={createBackup} disabled={!name.trim()}>
            Initialize Task Sequence
          </ActionButton>
        </div>
      </div>

      {/* Dynamic Terminal Output Module */}
      {(command || output || loading) && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
          <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">Backup Core Utility TTY Terminal Echo</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}

      {/* Snapshot History Matrix Registry */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
          <Calendar className="w-4 h-4 text-orange-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Vault Manifest Allocation Indexes</h3>
        </div>

        <div className="overflow-x-auto max-h-[400px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Snapshot Identifier</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-36">Format Type</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-28">Status Flag</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Disk Weight</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Compiled Frame Time</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {backupsList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-slate-500 font-medium italic">
                    No matching backup archives index records exist inside repository arrays.
                  </td>
                </tr>
              ) : (
                backupsList.map((b) => {
                  const isCompleted = b.status === "completed";
                  const isFailed = b.status === "failed";

                  return (
                    <tr key={b.id} className="hover:bg-slate-800/30 transition group">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-200 group-hover:text-orange-400 transition">
                        {b.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-slate-400 uppercase tracking-wide">
                          {b.type || "folder"}
                        </span>
                        {b.encryption && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 lowercase tracking-wide">
                            locked
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide border ${
                          isCompleted
                            ? "bg-green-500/10 border-green-500/20 text-green-400"
                            : isFailed
                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                            : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                        }`}>
                          {b.status?.toUpperCase() || "PENDING"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">{b.size || "---"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                        {b.createdAt ? new Date(b.createdAt).toLocaleString() : "---"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1 bg-slate-950 p-1 border border-slate-800/80 rounded-lg">
                          <button
                            onClick={() => { setRestoringId(b.id); setRestorePassword(""); }}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded transition"
                            title="Restore Snapshot Target"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteBackup(b.id)}
                            className="p-1.5 bg-slate-900 hover:bg-red-950/30 text-slate-400 hover:text-red-400 rounded transition"
                            title="Purge Archive Node"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Drawer Layout Backdrop: Deployment Target Rollback */}
      {restoringId && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 scale-100 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-200">Revert Volume Image Target</h3>
              <button onClick={() => setRestoringId(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Caution: Proceeding will overwrite existing production directories with this archive snapshot asset reference footprint.
            </p>

            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Archive Decryption Passphrase</label>
              <div className="relative flex items-center">
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
                <input type="password" value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)}
                  placeholder="Leave completely blank if unencrypted..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm font-mono outline-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
              <ActionButton onClick={() => setRestoringId(null)} variant="secondary">Abort Context</ActionButton>
              <ActionButton onClick={() => restoreBackup(restoringId)}>Execute Restore</ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}