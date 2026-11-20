export type Page =
  | "dashboard"
  | "produtos"
  | "categorias"
  | "fornecedores"
  | "movimentacoes"
  | "ajustes"
  | "historico"
  | "relatorios"
  | "usuarios";

export type AppRole = "admin" | "colaborador";
export type MovementType = "entrada" | "saida" | "ajuste";

export const roleLabel: Record<AppRole, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
};

export const movementLabel: Record<MovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
};

export const pagePath = {
  dashboard: "/dashboard",
  produtos: "/produtos",
  categorias: "/categorias",
  fornecedores: "/fornecedores",
  movimentacoes: "/movimentacoes",
  ajustes: "/ajustes",
  historico: "/historico",
  relatorios: "/relatorios",
  usuarios: "/usuarios",
} as const satisfies Record<Page, string>;

export const nav: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "produtos", label: "Produtos", icon: "box" },
  { id: "categorias", label: "Categorias", icon: "tag" },
  { id: "fornecedores", label: "Fornecedores", icon: "truck" },
  { id: "movimentacoes", label: "Movimentações", icon: "swap" },
  { id: "ajustes", label: "Ajuste de inventário", icon: "edit" },
  { id: "historico", label: "Histórico", icon: "clock" },
  { id: "relatorios", label: "Relatórios", icon: "chart" },
  { id: "usuarios", label: "Usuários", icon: "users" },
];

/** Screens a Colaborador can open; Administradores see every screen. */
export const collaboratorPages: Page[] = [
  "dashboard",
  "produtos",
  "categorias",
  "fornecedores",
  "movimentacoes",
  "ajustes",
  "historico",
];

export type StockStatus = "Inativo" | "Sem estoque" | "Estoque baixo" | "Em estoque";

export function stockStatus(stock: number, min: number, active = true): StockStatus {
  if (!active) return "Inativo";
  if (stock === 0) return "Sem estoque";
  if (stock <= min) return "Estoque baixo";
  return "Em estoque";
}

/** Returns the error message for an entry/exit, or null when it is allowed. Stock never goes negative. */
export function movementError(type: "entrada" | "saida", qty: number, available: number): string | null {
  if (type === "saida" && qty > available)
    return `Saída não permitida. O estoque disponível é de ${available} unidades.`;
  if (!Number.isInteger(qty) || qty < 1) return "Informe uma quantidade maior que zero.";
  return null;
}

/** Returns the error message for an inventory adjustment, or null when it can be reviewed. */
export function adjustmentError(countedStock: number, currentStock: number, reason: string): string | null {
  if (countedStock < 0 || !Number.isInteger(countedStock))
    return "Informe uma quantidade física válida, sem casas decimais.";
  if (!reason.trim()) return "Informe o motivo do ajuste para manter a rastreabilidade.";
  if (countedStock - currentStock === 0)
    return "A quantidade física é igual ao saldo atual. Nenhum ajuste é necessário.";
  return null;
}

/** Quantity with its effect on stock: exits are negative, adjustments keep their own sign. */
export function signedQuantity(type: MovementType, quantity: number) {
  return type === "saida" ? -Math.abs(quantity) : type === "entrada" ? Math.abs(quantity) : quantity;
}

export function formatSigned(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
}

export function formatPrice(price: number) {
  return `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** yyyy-mm-dd in the browser's local time zone. */
export function localISODate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d = new Date()) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "Hoje, 10:42", "Ontem, 16:30" or "18/06/2025, 11:22". */
export function formatMovementDate(iso: string, now = new Date()) {
  const d = new Date(iso);
  const today = startOfDay(now).getTime();
  const day = startOfDay(d).getTime();
  if (day === today) return `Hoje, ${timeFmt.format(d)}`;
  if (day === today - 86_400_000) return `Ontem, ${timeFmt.format(d)}`;
  return dateTimeFmt.format(d);
}

export function formatNow() {
  return dateTimeFmt.format(new Date());
}

/** Turns rows into a CSV file (semicolon-separated, which Excel in pt-BR opens correctly) and downloads it. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Readable message from a backend error. */
export function errorMessage(error: unknown, fallback = "Não foi possível concluir. Tente novamente.") {
  if (error && typeof error === "object") {
    const e = error as { code?: string; message?: string };
    if (e.code === "23505") return "Já existe um registro com esses dados (nome ou código repetido).";
    if (e.code === "23503") return "Este registro está em uso e não pode ser removido.";
    if (e.message) return e.message;
  }
  return fallback;
}
