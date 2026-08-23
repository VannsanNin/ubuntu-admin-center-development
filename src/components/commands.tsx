
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  BookOpen,
  Search,
  Code2,
  Terminal,
  AlertTriangle,
  Compass,
  FileText,
  Bookmark
} from "lucide-react";

/* ================= COMMANDS MODULE ================= */
export function CommandsModule() {
  const [commands, setCommands] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const fetchCommands = useCallback(async () => {
    try {
      const res = await api.get(`/commands?search=${search}`);
      const data = res.data.commands || [];
      setCommands(data);
      // Auto-select first command if none selected and data exists
      if (data.length > 0 && !selected) {
        setSelected(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch from reference command array:", err);
    }
  }, [search, selected]);

  useEffect(() => {
    fetchCommands();
  }, [fetchCommands]);

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">SysAdmin Command Manual & Library</h2>
            <p className="text-xs text-slate-400 mt-0.5">Lookup runtime command flags, avoid operational syntax mistakes, and study verified system shell patterns</p>
          </div>
        </div>
      </div>

      {/* Dynamic Filter Search Bar */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter utility manuals (e.g. tar, systemctl, netstat)..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900/40 border border-slate-800/80 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 rounded-xl text-sm font-sans transition outline-none backdrop-blur-sm placeholder:text-slate-600"
        />
      </div>

      {/* Dual Pane split workspace engine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Sidebar Nav: Command Selector */}
        <div className="lg:col-span-1 bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden max-h-[650px] flex flex-col backdrop-blur-sm shadow-sm">
          <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-2 text-slate-400">
            <Terminal className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Indexed Shell Manuals ({commands.length})</span>
          </div>
          
          <div className="overflow-y-auto divide-y divide-slate-800/40 scrollbar-thin scrollbar-thumb-slate-800">
            {commands.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 font-medium italic">
                No shell programs matched query string.
              </div>
            ) : (
              commands.map((cmd) => {
                const isActive = selected?.id === cmd.id;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => setSelected(cmd)}
                    className={`w-full text-left px-4 py-3.5 transition group relative flex flex-col gap-1 ${
                      isActive 
                        ? "bg-slate-800/50" 
                        : "hover:bg-slate-800/20"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500" />
                    )}
                    <p className={`font-mono text-xs font-bold transition ${
                      isActive ? "text-orange-400" : "text-slate-300 group-hover:text-white"
                    }`}>
                      {cmd.command}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                      {cmd.category || "General"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Master details viewport node space */}
        <div className="lg:col-span-2 bg-slate-900/20 border border-slate-800/80 rounded-xl p-6 backdrop-blur-sm shadow-sm min-h-[450px]">
          {selected ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header profile title summary block */}
              <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold font-mono tracking-tight text-white">{selected.command}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      <Bookmark className="w-2.5 h-2.5 text-orange-500" /> {selected.category || "General Core System"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scope Segment: Operational Description */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" /> Functional Description
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed font-sans">{selected.description}</p>
              </div>

              {/* Scope Segment: Syntax Notation */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-slate-400" /> Parameter Expression Syntax
                </h4>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-mono text-xs text-orange-400/90 shadow-inner select-all overflow-x-auto">
                  {selected.syntax}
                </div>
              </div>

              {/* Scope Segment: Available Flags & Modifiers */}
              {selected.options && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Arg Switches & Options Flags</h4>
                  <div className="text-xs text-slate-300 bg-slate-900/50 rounded-xl p-3 border border-slate-800/60 font-mono leading-relaxed whitespace-pre-wrap">
                    {selected.options}
                  </div>
                </div>
              )}

              {/* Scope Segment: Real World Action Examples */}
              {selected.examples && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-400" /> Verified Shell Snippet Use Cases
                  </h4>
                  <pre className="bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap overflow-x-auto leading-relaxed shadow-inner selection:bg-orange-500/20">
                    {selected.examples}
                  </pre>
                </div>
              )}

              {/* Scope Segment: Destructive Mistakes & Mitigations */}
              {selected.commonMistakes && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Common Pitfalls & Anti-Patterns
                  </h4>
                  <p className="text-xs text-red-300/90 font-sans leading-relaxed">{selected.commonMistakes}</p>
                </div>
              )}

              {/* Scope Segment: Alternative Companions */}
              {selected.relatedCommands && (
                <div className="pt-4 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                  <Compass className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-medium text-[10px] font-bold uppercase tracking-wider">See Also Cross-References:</span>
                  <span className="font-mono text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800/80">{selected.relatedCommands}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-80 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-slate-700 stroke-[1.5]" />
              <p className="text-xs text-slate-500 font-medium">Select a utility catalog node from the interface list to inspect assembly instructions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
