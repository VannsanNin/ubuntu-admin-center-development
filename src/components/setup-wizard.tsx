
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { ActionButton } from "./shared";

interface Prerequisite {
  found: boolean;
  version: string;
}

interface SetupStatus {
  node: Prerequisite;
  npm: Prerequisite;
  python: Prerequisite;
  pip: Prerequisite;
  npmModulesInstalled: boolean;
  pipModulesInstalled: boolean;
}

interface StepOutput {
  step: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "prerequisites", label: "Prerequisites" },
  { id: "npm", label: "Frontend Deps" },
  { id: "pip", label: "Backend Deps" },
  { id: "complete", label: "Complete" },
];

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [stepResults, setStepResults] = useState<Record<string, StepOutput>>({});

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get("/system/setup/status");
      setStatus(res.data);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const runStep = async (step: string) => {
    setRunning(true);
    setOutput("");
    try {
      const res = await api.post("/system/setup/run", { step });
      setStepResults((prev) => ({
        ...prev,
        [step]: res.data,
      }));
      setOutput(res.data.stdout || res.data.stderr || "Completed");
      if (res.data.exitCode !== 0) {
        setOutput((prev) => prev + `\n\nExit code: ${res.data.exitCode}`);
      }
    } catch (err: any) {
      const msg = String((err as any)?.response?.data?.detail || (err as any)?.response?.data?.error || err);
      setOutput("Error: " + msg);
      setStepResults((prev) => ({
        ...prev,
        [step]: { step, stdout: "", stderr: msg, exitCode: 1 },
      }));
    }
    setRunning(false);
    await checkStatus();
  };

  const allPrereqsMet = status
    ? status.node.found && status.npm.found && status.python.found && status.pip.found
    : false;

  const npmDone = stepResults["npm"]?.exitCode === 0 || status?.npmModulesInstalled;
  const pipDone = stepResults["pip"]?.exitCode === 0 || status?.pipModulesInstalled;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setupComplete = npmDone && pipDone;

  const activeStep = (): number => {
    if (currentStep === 0) return 0;
    if (currentStep >= 4) return 4;
    return currentStep;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Ubuntu Admin Center</h2>
              <p className="text-xs text-slate-500">First-time setup</p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mb-4">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-colors ${
                    i < activeStep()
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : i === activeStep()
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "bg-slate-800 text-slate-600 border border-slate-700"
                  }`}
                >
                  {i < activeStep() ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-[10px] font-medium hidden sm:block ${
                    i === activeStep() ? "text-orange-400" : "text-slate-600"
                  }`}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-1 ${
                      i < activeStep() ? "bg-emerald-500/30" : "bg-slate-800"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-100">Welcome!</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                This setup will check your system requirements and install necessary dependencies
                to get Ubuntu Admin Center running.
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-400">Step 1:</span>
                  <span className="text-slate-300">Check prerequisites (Node.js, Python, npm, pip)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-400">Step 2:</span>
                  <span className="text-slate-300">Install frontend dependencies (npm install)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-400">Step 3:</span>
                  <span className="text-slate-300">Install backend dependencies (pip install)</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Prerequisites */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-100">Checking Prerequisites</h3>
              <p className="text-sm text-slate-400">
                Verifying that all required tools are installed on your system.
              </p>
              <div className="space-y-2">
                {[
                  { key: "node" as const, label: "Node.js" },
                  { key: "npm" as const, label: "npm" },
                  { key: "python" as const, label: "Python" },
                  { key: "pip" as const, label: "pip" },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-4 py-3"
                  >
                    <span className="text-sm text-slate-300">{item.label}</span>
                    <span className="flex items-center gap-2">
                      {status ? (
                        status[item.key].found ? (
                          <>
                            <span className="text-xs font-mono text-slate-500">
                              v{status[item.key].version.replace(/^v/, "")}
                            </span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-red-400">Not found</span>
                            <XCircle className="w-4 h-4 text-red-400" />
                          </>
                        )
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {status && !allPrereqsMet && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Some prerequisites are missing. Install them and click Refresh.
                </p>
              )}
            </div>
          )}

          {/* Step 2: npm install */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-100">Frontend Dependencies</h3>
              <p className="text-sm text-slate-400">
                Installing npm packages required for the web interface.
              </p>
              {!npmDone && (
                <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-950/20 border border-amber-900/30 rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Click &quot;Install&quot; to run npm install
                </div>
              )}
              {output && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{output}</pre>
                </div>
              )}
              <div className="flex items-center gap-2">
                {npmDone ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Frontend dependencies installed
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    {status?.npmModulesInstalled ? "Already installed" : "Not installed yet"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Step 3: pip install */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-100">Backend Dependencies</h3>
              <p className="text-sm text-slate-400">
                Installing Python packages required for the backend API.
              </p>
              {!pipDone && (
                <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-950/20 border border-amber-900/30 rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Click &quot;Install&quot; to run pip install
                </div>
              )}
              {output && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{output}</pre>
                </div>
              )}
              <div className="flex items-center gap-2">
                {pipDone ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Backend dependencies installed
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    {status?.pipModulesInstalled ? "Already installed" : "Not installed yet"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 4 && (
            <div className="space-y-4 text-center py-6">
              <div className="flex justify-center">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-100">Setup Complete!</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                All dependencies have been installed. You can now start using Ubuntu Admin Center.
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left space-y-2 max-w-md mx-auto">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">Prerequisites checked</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">Frontend dependencies installed</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">Backend dependencies installed</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            {running && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running...
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep === 0 && (
              <ActionButton onClick={() => setCurrentStep(1)}>
                <span className="flex items-center gap-1.5 text-sm">
                  Get Started <ArrowRight className="w-4 h-4" />
                </span>
              </ActionButton>
            )}
            {currentStep === 1 && (
              <div className="flex gap-2">
                <ActionButton onClick={checkStatus} variant="secondary" disabled={!status}>
                  <RefreshCw className="w-4 h-4" />
                </ActionButton>
                <ActionButton onClick={() => setCurrentStep(2)} disabled={!allPrereqsMet}>
                  <span className="flex items-center gap-1.5 text-sm">
                    Continue <ArrowRight className="w-4 h-4" />
                  </span>
                </ActionButton>
              </div>
            )}
            {currentStep === 2 && (
              <div className="flex gap-2">
                <ActionButton onClick={() => setCurrentStep(1)} variant="secondary">
                  Back
                </ActionButton>
                {!npmDone ? (
                  <ActionButton onClick={() => runStep("npm")} disabled={running}>
                    {running ? <Loader2 className="w-4 h-4 animate-spin" /> : "Install npm packages"}
                  </ActionButton>
                ) : (
                  <ActionButton onClick={() => setCurrentStep(3)}>
                    <span className="flex items-center gap-1.5 text-sm">
                      Continue <ArrowRight className="w-4 h-4" />
                    </span>
                  </ActionButton>
                )}
              </div>
            )}
            {currentStep === 3 && (
              <div className="flex gap-2">
                <ActionButton onClick={() => setCurrentStep(2)} variant="secondary">
                  Back
                </ActionButton>
                {!pipDone ? (
                  <ActionButton onClick={() => runStep("pip")} disabled={running}>
                    {running ? <Loader2 className="w-4 h-4 animate-spin" /> : "Install Python packages"}
                  </ActionButton>
                ) : (
                  <ActionButton onClick={() => setCurrentStep(4)}>
                    <span className="flex items-center gap-1.5 text-sm">
                      Continue <ArrowRight className="w-4 h-4" />
                    </span>
                  </ActionButton>
                )}
              </div>
            )}
            {currentStep === 4 && (
              <ActionButton onClick={onComplete}>
                <span className="flex items-center gap-1.5 text-sm">
                  Go to Dashboard <ArrowRight className="w-4 h-4" />
                </span>
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
