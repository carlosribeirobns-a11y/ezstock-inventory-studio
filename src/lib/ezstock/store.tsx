import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { movementsSeed, productsSeed, userForRole, type Movement, type Product, type Role } from "./data";

/**
 * In-memory prototype state, same as the original Figma Make prototype:
 * everything resets when the page is reloaded.
 */
type EzStockState = {
  logged: boolean;
  role: Role;
  currentUser: string;
  initials: string;
  products: Product[];
  movements: Movement[];
  toast: string;
  login: (role: Role) => void;
  logout: () => void;
  setProducts: (p: Product[]) => void;
  setMovements: (m: Movement[]) => void;
  notify: (text: string) => void;
};

const EzStockContext = createContext<EzStockState | null>(null);

export function EzStockProvider({ children }: { children: ReactNode }) {
  const [logged, setLogged] = useState(false);
  const [role, setRole] = useState<Role>("Administrador");
  const [products, setProducts] = useState<Product[]>(productsSeed);
  const [movements, setMovements] = useState<Movement[]>(movementsSeed);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  }, []);

  const value = useMemo<EzStockState>(() => {
    const user = userForRole(role);
    return {
      logged,
      role,
      currentUser: user.name,
      initials: user.initials,
      products,
      movements,
      toast,
      login: (r) => {
        setRole(r);
        setLogged(true);
      },
      logout: () => setLogged(false),
      setProducts,
      setMovements,
      notify,
    };
  }, [logged, role, products, movements, toast, notify]);

  return <EzStockContext.Provider value={value}>{children}</EzStockContext.Provider>;
}

export function useEzStock() {
  const ctx = useContext(EzStockContext);
  if (!ctx) throw new Error("useEzStock must be used inside EzStockProvider");
  return ctx;
}
