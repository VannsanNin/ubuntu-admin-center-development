
import { Loader2, AlertTriangle, Terminal } from "lucide-react";

function TerminalOutput({ command, output, loading }: { command?: string; output: string; loading?: boolean }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
      {command && (
        <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
          <Terminal className="w-3 h-3 text-orange-500" />
          <span className="text-xs font-mono text-slate-300">{command}</span>
        </div>
      )}
      <div className="p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-64 overflow-auto">
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Executing...
          </div>
        ) : (
          output || "No output"
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
  variant = "primary",
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "danger" | "secondary";
  disabled?: boolean;
}) {
  const variants = {
    primary: "bg-orange-600 hover:bg-orange-500 text-white",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-slate-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <ActionButton onClick={onCancel} variant="secondary">
            Cancel
          </ActionButton>
          <ActionButton onClick={onConfirm} variant="danger">
            Confirm
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export { TerminalOutput, ActionButton, ConfirmDialog };
