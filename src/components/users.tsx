
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Users,
  Eye,
  Lock,
  Trash2,
  Unlock,
  X,
  Terminal,
  UserPlus,
  KeyRound,
  FolderOpen,
  UserCheck
} from "lucide-react";
import { TerminalOutput, ActionButton, ConfirmDialog } from "./shared";

/* ================= USERS MODULE ================= */
export function UsersModule() {
  const [users, setUsers] = useState<any[]>([]);
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [group, setGroup] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    username: string;
  } | null>(null);
  const [viewHistory, setViewHistory] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/system/users");
      setUsers(res.data.users || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAction = async (action: string, uname: string, extra?: any) => {
    setLoading(true);
    try {
      const res = await api.post("/system/users", {
        action,
        username: uname,
        password: extra?.password,
        group: extra?.group,
      });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchUsers();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Error adjusting user configurations.");
    }
    setLoading(false);
    setConfirmAction(null);
  };

  const showHistory = async (uname: string) => {
    setViewHistory(uname);
    setLoginHistory("");
    try {
      const res = await api.get(`/system/users?action=history&username=${uname}`);
      setLoginHistory(res.data.history);
    } catch (err: any) {
      setLoginHistory("Failed to load target system session history.");
    }
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Identity & User Manager</h2>
            <p className="text-xs text-slate-400 mt-0.5">Control system authentication realms, secondary groupings, and host access parameters</p>
          </div>
        </div>
      </div>

      {/* Control Configuration Grid Card */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-4 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative flex items-center">
            <UserPlus className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Target Username"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
            />
          </div>
          <div className="relative flex items-center">
            <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Access Password Context"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
            />
          </div>
          <div className="relative flex items-center">
            <FolderOpen className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="Target Linux Group Mapping"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-start md:justify-end border-t border-slate-800/60 pt-3">
          <ActionButton onClick={() => handleAction("create", username)}>
            Provision User
          </ActionButton>
          <ActionButton onClick={() => handleAction("resetPassword", username, { password })}>
            Update Key
          </ActionButton>
          <ActionButton onClick={() => handleAction("addGroup", username, { group })}>
            Attach Group
          </ActionButton>
          <ActionButton onClick={() => handleAction("removeGroup", username, { group })} variant="secondary">
            Detach Group
          </ActionButton>
        </div>
      </div>

      {/* Dynamic Terminal Output Module */}
      {(command || output || loading) && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
          <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">Identity Logs Processing Console</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}

      {/* Main Account Grid Table */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
        <div className="px-4 py-3 bg-slate-900/30 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Account Profiles Table</h3>
          </div>
          <span className="text-xs font-medium text-slate-500">{users.length} active mappings</span>
        </div>

        <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
              <tr>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Username Context</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">UID</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Home Directory</th>
                <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Default Shell</th>
                <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-36">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-slate-500 font-medium">
                    No active operating system users discovered in passwd bounds.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.username} className="hover:bg-slate-800/30 transition group">
                    <td className="px-4 py-2.5 font-sans text-xs font-semibold text-slate-200 group-hover:text-orange-400 transition flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500 group-hover:text-orange-500/70" />
                      {u.username}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-orange-400/80">{u.uid}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono truncate max-w-xs">{u.home}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{u.shell}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1 bg-slate-950/60 p-1 border border-slate-800 rounded-lg">
                        <button
                          onClick={() => showHistory(u.username)}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition border border-slate-800/50"
                          title="View Login Session History"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        
                        <div className="w-px bg-slate-800 mx-0.5 self-stretch" />

                        <button
                          onClick={() => setConfirmAction({ action: "lock", username: u.username })}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-yellow-500 rounded transition border border-slate-800/50"
                          title="Lock User Account"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleAction("unlock", u.username)}
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-green-400 rounded transition border border-slate-800/50"
                          title="Unlock User Account"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                        </button>

                        <div className="w-px bg-slate-800 mx-0.5 self-stretch" />

                        <button
                          onClick={() => setConfirmAction({ action: "delete", username: u.username })}
                          className="p-1.5 bg-red-950/30 hover:bg-red-900/30 text-red-400 rounded transition border border-red-900/20"
                          title="De-provision System User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminal History Modal Viewer */}
      {viewHistory && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-200 tracking-tight">Login Trace Log</h3>
                <p className="text-xs font-mono text-orange-500 mt-0.5">Session Target: {viewHistory}</p>
              </div>
              <button
                onClick={() => setViewHistory(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Console Log Output Display */}
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-slate-300 whitespace-pre-wrap bg-slate-950 rounded-b-2xl leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
              {loginHistory || "No log trace points discovered for target system user identity."}
            </div>
          </div>
        </div>
      )}

      {/* Guard Confirm Dialog Components */}
      <ConfirmDialog
        open={confirmAction !== null}
        title={`Confirm Security State Event`}
        message={`Are you sure you want to trigger a status update change [${confirmAction?.action?.toUpperCase()}] for account parameter label: "${confirmAction?.username}"? This changes systemic file and system configurations immediately.`}
        onConfirm={() => confirmAction && handleAction(confirmAction.action, confirmAction.username)}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}