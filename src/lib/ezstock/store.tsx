import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ezstock/ui";

/** Small confirmation message shown at the bottom right, same as the original prototype. */
type Notify = (text: string, kind?: "success" | "error") => void;
const NotifyContext = createContext<Notify | null>(null);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const notify = useCallback<Notify>((text, kind = "success") => {
    setToast({ text, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);
  return (
    <NotifyContext.Provider value={notify}>
      {children}
      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          <span><Icon name={toast.kind === "error" ? "alert" : "check"} size={16} /></span>
          {toast.text}
        </div>
      )}
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error("useNotify must be used inside NotifyProvider");
  return ctx;
}
