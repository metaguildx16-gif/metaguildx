export type ToastType = "success" | "error" | "warning" | "info";

export type ToastMessage = {
  id: number;
  message: string;
  type: ToastType;
};

function tone(type: ToastType) {
  if (type === "success") {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-100";
  }
  if (type === "error") {
    return "border-red-500/30 bg-red-500/15 text-red-100";
  }
  if (type === "warning") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-100";
  }
  return "border-blue-500/30 bg-blue-500/15 text-blue-100";
}

export function Toast({
  toast,
  onDismiss
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 shadow-xl shadow-black/30 ${tone(
        toast.type
      )}`}
    >
      <p className="text-sm">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-xs uppercase tracking-[0.2em] opacity-80 transition hover:opacity-100"
      >
        X
      </button>
    </div>
  );
}

export function ToastStack({
  toasts,
  onDismiss
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed right-6 top-6 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
