
import { useState, useEffect, useCallback, useRef } from "react";
import { api, downloadFile } from "@/lib/api";
import {
  ChevronLeft,
  Download,
  File,
  Folder,
  FolderOpen,
  Upload,
  Terminal,
  PlusCircle,
  HardDrive
} from "lucide-react";
import { TerminalOutput, ActionButton } from "./shared";

/* ================= FILES MODULE ================= */
export function FilesModule() {
  const [path, setPath] = useState("/home/developer");
  const [files, setFiles] = useState<any[]>([]);
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await api.get(`/system/files?path=${encodeURIComponent(path)}`);
      setFiles(res.data.files || []);
    } catch (err) {
      console.error(err);
    }
  }, [path]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleAction = async (action: string, source?: string, dest?: string) => {
    setLoading(true);
    try {
      const res = await api.post("/system/files", {
        action,
        source: source || path,
        destination: dest,
      });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      setNewName("");
      fetchFiles();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "File operations constraint violation.");
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(`/system/files/upload?path=${encodeURIComponent(path)}`, formData);
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchFiles();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Failsafe upload sequence abort.");
    }
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const traverseBack = () => {
    const segments = path.split("/").filter(Boolean);
    segments.pop();
    setPath("/" + segments.join("/"));
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Host Storage Explorer</h2>
            <p className="text-xs text-slate-400 mt-0.5">Inspect system volumes, write directory partitions, and staging payloads</p>
          </div>
        </div>
      </div>

      {/* Navigation & Action Workspace Bar */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center gap-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={traverseBack}
            disabled={path === "/"}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition disabled:opacity-40 disabled:hover:bg-slate-950 disabled:hover:text-slate-400"
            title="Parent Directory"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono text-orange-400 truncate flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            {path}
          </div>
        </div>

        {/* Directory Operations Group */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center max-w-[180px]">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Folder label..."
              className="w-full pl-3 pr-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-lg text-sm transition outline-none placeholder:text-slate-600"
            />
          </div>
          
          <ActionButton 
            onClick={() => handleAction("mkdir", `${path}/${newName}`.replace(/\/+/g, "/"))}
            disabled={!newName.trim()}
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            Mkdir
          </ActionButton>

          <div className="w-px bg-slate-800 h-8 hidden sm:block mx-1" />

          <input 
            ref={fileInputRef} 
            type="file" 
            onChange={handleUpload} 
            className="hidden" 
          />
          <ActionButton onClick={() => fileInputRef.current?.click()} variant="secondary">
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload File
          </ActionButton>
        </div>
      </div>

      {/* Dynamic Terminal Output Module */}
      {(command || output || loading) && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
          <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">Virtual VFS System Echo Logs</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}

      {/* Main Files Grid Wrapper */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 min-h-[300px] backdrop-blur-sm">
        <div className="border-b border-slate-800/60 pb-2 mb-4 flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Index Descriptor Canvas</span>
          <span className="text-xs font-medium text-slate-500">{files.length} allocations</span>
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Folder className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-sm font-medium">This target directory contains no assets.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {files.map((file) => {
              const isDir = !!file.isDirectory;
              
              return (
                <div
                  key={file.name}
                  onClick={() => isDir && setPath(`${path}/${file.name}`.replace(/\/+/g, "/"))}
                  className={`flex items-center gap-3 p-3 rounded-xl border border-slate-800/50 hover:border-slate-700/60 transition group ${
                    isDir 
                      ? "bg-slate-950/40 hover:bg-slate-900/40 cursor-pointer" 
                      : "bg-slate-950/20"
                  }`}
                >
                  <div className="shrink-0">
                    {isDir ? (
                      <Folder className="w-5 h-5 text-yellow-500/90 fill-yellow-500/5 group-hover:scale-105 transition duration-150" />
                    ) : (
                      <File className="w-5 h-5 text-blue-400/90 group-hover:scale-105 transition duration-150" />
                    )}
                  </div>
                  
                  <span className="text-xs font-mono truncate flex-1 text-slate-300 group-hover:text-slate-100 transition" title={file.name}>
                    {file.name}
                  </span>

                  {!isDir && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void downloadFile(`${path}/${file.name}`.replace(/\/+/g, "/"));
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-orange-400 rounded-md border border-slate-800 transition shadow-sm"
                      title="Download Resource"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}