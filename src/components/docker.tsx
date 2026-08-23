
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Activity,
  Container,
  Eye,
  Play,
  RotateCcw,
  Square,
  Trash2,
  X,
  Terminal,
  Layers,
  PlusCircle,
  FileCode,
  DownloadCloud
} from "lucide-react";
import { TerminalOutput, ActionButton } from "./shared";

/* ================= DOCKER MODULE ================= */
export function DockerModule() {
  const [containers, setContainers] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [tab, setTab] = useState<"containers" | "images">("containers");
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageName, setImageName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showStats, setShowStats] = useState<any>(null);
  const [statsData, setStatsData] = useState("");
  const [createForm, setCreateForm] = useState({ image: "", containerName: "", ports: "", env: "" });
  const [composeContent, setComposeContent] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [containersRes, imagesRes] = await Promise.all([
        api.get("/system/docker"),
        api.get("/system/docker?action=images"),
      ]);
      setContainers(containersRes.data.containers || []);
      setImages(imagesRes.data.images || []);
    } catch (err) {
      console.error("Docker daemon sync error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAction = async (action: string, target: string, extra?: any) => {
    setLoading(true);
    try {
      const payload: any = { action, container: target, image: target };
      if (extra) Object.assign(payload, extra);
      const res = await api.post("/system/docker", payload);
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchData();
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Daemon action execution error");
    }
    setLoading(false);
  };

  const createContainer = async () => {
    setLoading(true);
    try {
      const res = await api.post("/system/docker", {
        action: "create",
        image: createForm.image,
        containerName: createForm.containerName,
        ports: createForm.ports,
        env: createForm.env,
      });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchData();
      setShowCreate(false);
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Container allocation failed");
    }
    setLoading(false);
  };

  const viewStats = async (name: string) => {
    setShowStats(name);
    setStatsData("");
    try {
      const res = await api.post("/system/docker", { action: "stats", container: name });
      setStatsData(res.data.stdout);
    } catch (err: any) {
      setStatsData("Failed to extract container daemon telemetry matrix.");
    }
  };

  const runCompose = async (action: string) => {
    setLoading(true);
    try {
      const res = await api.post("/system/docker", {
        action,
        composeContent: composeContent,
        container: "",
        image: "",
      });
      setCommand(res.data.command);
      setOutput((res.data.stdout || "") + (res.data.stderr || ""));
      fetchData();
      setShowCompose(false);
    } catch (err: any) {
      setOutput(err.response?.data?.error || "Stack initialization error");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Container className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Docker Virtualization Node</h2>
            <p className="text-xs text-slate-400 mt-0.5">Orchestrate container lifecycles, monitor task states, and manage runtime images</p>
          </div>
        </div>

        {/* Global Toolbar Control Hub */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 p-1.5 border border-slate-800/80 rounded-xl backdrop-blur-sm">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setTab("containers")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                tab === "containers"
                  ? "bg-slate-800 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Containers ({containers.length})
            </button>
            <button
              onClick={() => setTab("images")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                tab === "images"
                  ? "bg-slate-800 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Images ({images.length})
            </button>
          </div>

          <div className="w-px bg-slate-800 h-6 mx-1" />

          {tab === "containers" && (
            <div className="flex gap-1">
              <ActionButton onClick={() => setShowCreate(true)}>
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> Create
              </ActionButton>
              <ActionButton onClick={() => setShowCompose(true)} variant="secondary">
                <FileCode className="w-3.5 h-3.5 mr-1" /> Compose
              </ActionButton>
            </div>
          )}

          <div className="w-px bg-slate-800 h-6 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <DownloadCloud className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
              <input
                value={imageName}
                onChange={(e) => setImageName(e.target.value)}
                placeholder="Pull image reference..."
                className="pl-8 pr-2 py-1 bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-lg text-xs font-mono transition outline-none w-44"
              />
            </div>
            <ActionButton onClick={() => handleAction("pull", imageName)} disabled={!imageName.trim()}>
              Pull
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Dynamic Terminal Output Module */}
      {(command || output || loading) && (
        <div className="border border-slate-800/80 rounded-xl overflow-hidden shadow-xl bg-slate-950">
          <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-mono font-medium">Docker Daemon Process Stream</span>
          </div>
          <TerminalOutput command={command} output={output} loading={loading} />
        </div>
      )}

      {/* Primary Tabular Views */}
      {tab === "containers" ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
          <div className="overflow-x-auto max-h-[550px] scrollbar-thin scrollbar-thumb-slate-800">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
                <tr>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Container Name</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Image Context</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-32">Status Flag</th>
                  <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-44">Operations Hub</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {containers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-sm text-slate-500 font-medium">
                      No active docker environments provisioned inside infrastructure bounds.
                    </td>
                  </tr>
                ) : (
                  containers.map((c, i) => {
                    const cName = c.name || c.Names;
                    const cImg = c.image || c.Image;
                    const cState = (c.state || c.State || c.status || c.Status || "").toLowerCase();
                    const isRunning = cState.includes("running") || cState.includes("up");

                    return (
                      <tr key={c.Id || c.id || i} className="hover:bg-slate-800/30 transition group">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-200 group-hover:text-orange-400 transition">
                          {cName}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400 font-mono truncate max-w-xs" title={cImg}>
                          {cImg}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide border ${
                            isRunning
                              ? "bg-green-500/10 border-green-500/20 text-green-400"
                              : "bg-slate-950 border-slate-800 text-slate-500"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isRunning ? "bg-green-400 animate-pulse" : "bg-slate-600"}`} />
                            {cState.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex gap-0.5 bg-slate-950/60 p-1 border border-slate-800 rounded-lg">
                            <button
                              onClick={() => handleAction("start", cName)}
                              disabled={isRunning}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-green-400 disabled:opacity-30 rounded transition"
                              title="Start Container"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleAction("stop", cName)}
                              disabled={!isRunning}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 disabled:opacity-30 rounded transition"
                              title="Stop Container"
                            >
                              <Square className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleAction("restart", cName)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded transition"
                              title="Restart Container"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            
                            <div className="w-px bg-slate-800 mx-0.5 self-stretch" />

                            <button
                              onClick={() => viewStats(cName)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-purple-400 rounded transition"
                              title="Live Stats Stream"
                            >
                              <Activity className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleAction("logs", cName)}
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded transition"
                              title="Inspect Container TTY"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleAction("remove", cName)}
                              className="p-1.5 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/10 rounded transition"
                              title="Purge Deployment"
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
      ) : (
        /* Registry Image Management Canvas Layout */
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm backdrop-blur-sm">
          <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-slate-800">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
                <tr>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider">Image Repository Reference</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-28">Version Tag</th>
                  <th className="text-left font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-32">Virtual Disk Size</th>
                  <th className="text-right font-semibold text-slate-400 px-4 py-3 text-xs uppercase tracking-wider w-24">Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {images.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-sm text-slate-500 font-medium">
                      No images pulled inside regional block caching arrays.
                    </td>
                  </tr>
                ) : (
                  images.map((img, i) => {
                    const imgRepo = img.repository || img.Repository;
                    const imgTag = img.tag || img.Tag;
                    const imgSize = img.size || img.Size;
                    const imgId = img.id || img.Id;

                    return (
                      <tr key={imgId || i} className="hover:bg-slate-800/30 transition group">
                        <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-200">
                          <span className="inline-flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-600" />
                            {imgRepo}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-orange-400/80">{imgTag}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{imgSize}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleAction("removeImage", imgId)}
                            className="p-1.5 bg-slate-950 hover:bg-red-900/20 text-slate-400 hover:text-red-400 rounded-lg border border-slate-800 transition"
                            title="De-allocate Image Blob"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Drawer: Provision Custom Container */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 scale-100 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-200">Initialize App Container</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Image Registry Source</label>
                <input value={createForm.image} onChange={(e) => setCreateForm({ ...createForm, image: e.target.value })}
                  placeholder="e.g. nginx:alpine" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm font-mono outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Target Name Identifier</label>
                <input value={createForm.containerName} onChange={(e) => setCreateForm({ ...createForm, containerName: e.target.value })}
                  placeholder="e.g. production_proxy" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Inbound Port Mappings</label>
                <input value={createForm.ports} onChange={(e) => setCreateForm({ ...createForm, ports: e.target.value })}
                  placeholder="e.g. 80:80,443:443" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm font-mono outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Environment Scope Flags Context</label>
                <input value={createForm.env} onChange={(e) => setCreateForm({ ...createForm, env: e.target.value })}
                  placeholder="e.g. NODE_ENV=production,PORT=80" className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-sm font-mono outline-none" />
              </div>
              <div className="pt-3 flex justify-end">
                <ActionButton onClick={createContainer}>Provision Stack Layer</ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Drawer: Compose Manifest Orchestration */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 scale-100 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-200">Compose Orchestration Editor</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Manifest declaration: docker-compose.yml</p>
              </div>
              <button onClick={() => setShowCompose(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={composeContent}
              onChange={(e) => setComposeContent(e.target.value)}
              placeholder="version: '3.8'&#10;services:&#10;  web:&#10;    image: nginx:latest&#10;    ports:&#10;      - '80:80'"
              className="w-full h-56 px-3 py-2 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-lg text-xs font-mono line-height-relaxed outline-none resize-none scrollbar-thin"
            />
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-800/60">
              <ActionButton onClick={() => runCompose("composeUp")}>Deploy (Up)</ActionButton>
              <ActionButton onClick={() => runCompose("composeDown")} variant="danger">Tear Down</ActionButton>
              <ActionButton onClick={() => runCompose("composeLogs")} variant="secondary">Pull Core Logs</ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Modal Drawer: Real-time Stats Telemetry Console */}
      {showStats && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-200">Resource Isolation Trace</h3>
                <p className="text-xs font-mono text-orange-500 mt-0.5">Target Scope: {showStats}</p>
              </div>
              <button onClick={() => setShowStats(null)} className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 border border-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 font-mono text-[11px] text-green-400 whitespace-pre-wrap bg-slate-950 max-h-72 overflow-y-auto leading-relaxed scrollbar-thin">
              {statsData || "Awaiting daemon profiling hook telemetry output..."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}