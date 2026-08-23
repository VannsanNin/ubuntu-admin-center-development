
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import {
  Bot,
  AlertTriangle,
  Loader2,
  User,
  Sparkles,
  Terminal,
  Send
} from "lucide-react";

/* ================= AI MODULE ================= */
export function AIModule() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: any }[]>([]);
  const [loading, setLoading] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll anchor helper
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const ask = async () => {
    if (!question.trim()) return;
    const currentQuery = question;
    setQuestion("");
    setLoading(true);
    
    try {
      const res = await api.post("/ai", { question: currentQuery });
      setHistory((prev) => [...prev, { q: currentQuery, a: res.data }]);
    } catch (err: any) {
      setHistory((prev) => [
        ...prev, 
        { 
          q: currentQuery, 
          a: { answer: "Operational response pipeline failure. Could not parse LLM token weights.", commands: [] } 
        }
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-7xl mx-auto p-1">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 shadow-inner">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">AI Systems Operator Copilot</h2>
            <p className="text-xs text-slate-400 mt-0.5">Query Linux manual patterns, isolate syntax errors, and generate automated server infrastructure scripts</p>
          </div>
        </div>
      </div>

      {/* Main Dialogue Chat Window */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm flex flex-col h-[550px]">
        <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-2 text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Active Copilot Context Session</span>
        </div>

        {/* Scrollable Conversation Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-slate-800 bg-slate-950/20">
          {history.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-6 max-w-md mx-auto">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                <Bot className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">Autonomous Shell Assistant Idle</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Provide systemic questions like <code className="text-orange-400 font-mono">"How do I filter log metrics for systemd anomalies?"</code> or ask for help building backup cron targets.
                </p>
              </div>
            </div>
          ) : (
            history.map((h, i) => (
              <div key={i} className="space-y-4 animate-in fade-in duration-200">
                {/* Outbound User Message Block */}
                <div className="flex items-start gap-3 justify-end max-w-3xl ml-auto">
                  <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-tr-none px-4 py-2.5 text-sm text-slate-200 shadow-sm font-sans">
                    {h.q}
                  </div>
                  <div className="p-2 bg-slate-800 border border-slate-700 rounded-xl shrink-0 text-slate-400 shadow-inner">
                    <User className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Inbound Agent Response Block */}
                <div className="flex items-start gap-3 max-w-3xl mr-auto">
                  <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-xl shrink-0 text-orange-400 shadow-inner">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-slate-300 space-y-3 shadow-md backdrop-blur-sm">
                    <p className="leading-relaxed font-sans text-slate-300">{h.a.answer}</p>
                    
                    {/* Condition: Destructive Mutation Alerts */}
                    {h.a.caution && (
                      <div className="flex items-start gap-2.5 px-3 py-2 bg-yellow-500/5 border border-yellow-500/10 rounded-xl text-yellow-500/90 text-xs font-sans leading-relaxed">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Cautionary Anti-Pattern Directive:</span> This operation modifies production file vectors. Verify backup images manually before deployment.
                        </div>
                      </div>
                    )}

                    {/* Condition: Generated Source Commands */}
                    {h.a.commands && h.a.commands.length > 0 && (
                      <div className="border border-slate-900 bg-black rounded-xl overflow-hidden shadow-inner">
                        <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-900 text-slate-500 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                          <Terminal className="w-3 h-3 text-orange-500" /> Synthesized Solution Snippet
                        </div>
                        <div className="p-3 space-y-1.5 overflow-x-auto selection:bg-orange-500/30">
                          {h.a.commands.map((cmd: string, ci: number) => (
                            <code key={ci} className="block text-xs font-mono text-orange-400/90 whitespace-pre select-all">
                              {cmd}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Condition: Streaming Token Loader State */}
          {loading && (
            <div className="flex items-start gap-3 max-w-3xl mr-auto animate-pulse">
              <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs text-slate-500 font-mono italic">
                Evaluating instruction topology matrix...
              </div>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Action Prompt Input Stage Footer */}
        <div className="p-3 bg-slate-900/40 border-t border-slate-800/80 backdrop-blur-sm">
          <div className="flex gap-2 relative items-center">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Ask copilot for system configurations, debugging help, or bash scripts..."
              disabled={loading}
              className="flex-1 pl-4 pr-12 py-2.5 bg-slate-950 border border-slate-800 focus:border-orange-500/40 rounded-xl text-sm font-sans outline-none text-slate-200 transition disabled:opacity-50 placeholder:text-slate-600 shadow-inner"
            />
            <button
              onClick={ask}
              disabled={loading || !question.trim()}
              className="absolute right-2 p-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed"
              title="Dispatch Prompt Query"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}