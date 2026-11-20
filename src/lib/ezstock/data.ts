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
export type Role = "Administrador" | "Colaborador";
export type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  stock: number;
  min: number;
  price: number;
  active: boolean;
};
export type MovementType = "Entrada" | "Saída" | "Ajuste";
export type Movement = {
  id: number;
  product: string;
  type: MovementType;
  qty: number;
  date: string;
  user: string;
  reason?: string;
  previousStock?: number;
  newStock?: number;
};

export const ADMIN_EMAIL = "admin@pontodabeleza.com.br";

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

export const productsSeed: Product[] = [
  { id: 1, name: "Shampoo Nutritivo 300ml", sku: "CAB-0012", category: "Cabelos", stock: 24, min: 8, price: 32.9, active: true },
  { id: 2, name: "Esmalte Cremoso Carmim", sku: "UNH-0084", category: "Unhas", stock: 4, min: 6, price: 8.5, active: true },
  { id: 3, name: "Hidratante Corporal Flor de Cerejeira", sku: "COR-0031", category: "Corpo e banho", stock: 0, min: 5, price: 27.9, active: true },
  { id: 4, name: "Máscara Capilar Reconstrução 500g", sku: "CAB-0047", category: "Cabelos", stock: 12, min: 4, price: 48.9, active: true },
  { id: 5, name: "Batom Matte Rosé", sku: "MAQ-0108", category: "Maquiagem", stock: 7, min: 10, price: 21.9, active: true },
  { id: 6, name: "Kit Pincéis Essenciais", sku: "ACE-0029", category: "Acessórios", stock: 18, min: 5, price: 59.9, active: true },
  { id: 7, name: "Sérum Facial Vitamina C", sku: "FAC-0062", category: "Cuidados faciais", stock: 9, min: 5, price: 42.5, active: false },
];

export const movementsSeed: Movement[] = [
  { id: 1, product: "Shampoo Nutritivo 300ml", type: "Entrada", qty: 12, date: "Hoje, 10:42", user: "Marina Souza" },
  { id: 2, product: "Batom Matte Rosé", type: "Saída", qty: 3, date: "Hoje, 09:18", user: "Lucas Lima" },
  { id: 3, product: "Kit Pincéis Essenciais", type: "Entrada", qty: 8, date: "Ontem, 16:30", user: "Marina Souza" },
  { id: 4, product: "Esmalte Cremoso Carmim", type: "Saída", qty: 5, date: "Ontem, 14:05", user: "Lucas Lima" },
  { id: 5, product: "Máscara Capilar Reconstrução 500g", type: "Saída", qty: 2, date: "18/06/2025, 11:22", user: "Marina Souza" },
];

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

export const collaboratorPages: Page[] = [
  "dashboard",
  "produtos",
  "categorias",
  "fornecedores",
  "movimentacoes",
  "ajustes",
  "historico",
];

export const entityData = {
  categorias: [
    ["Cabelos", "68 produtos", "Ativa"],
    ["Maquiagem", "52 produtos", "Ativa"],
    ["Unhas", "41 produtos", "Ativa"],
    ["Corpo e banho", "36 produtos", "Ativa"],
    ["Cuidados faciais", "29 produtos", "Ativa"],
    ["Acessórios", "22 produtos", "Ativa"],
  ],
  fornecedores: [
    ["Bella Cosméticos Distribuidora", "(11) 3456-7820", "contato@bellacosmeticos.com.br"],
    ["Essenza Atacado", "(19) 3264-1108", "vendas@essenza.com.br"],
    ["Nova Beleza Comercial", "(31) 3347-9022", "pedidos@novabeleza.com.br"],
    ["Mundo dos Cabelos", "(21) 2589-4430", "comercial@mundodoscabelos.com.br"],
  ],
  usuarios: [
    ["Marina Souza", "marina@pontodabeleza.com.br", "Administrador"],
    ["Lucas Lima", "lucas@pontodabeleza.com.br", "Colaborador"],
    ["Ana Carolina", "ana@pontodabeleza.com.br", "Colaborador"],
  ],
};

/** Demo login: the admin e-mail gets the admin view, any other account the collaborator view. */
export function roleForEmail(email: string): Role {
  return email.trim().toLowerCase() === ADMIN_EMAIL ? "Administrador" : "Colaborador";
}

export function userForRole(role: Role) {
  return role === "Administrador"
    ? { name: "Marina Souza", initials: "MS" }
    : { name: "Lucas Lima", initials: "LL" };
}

export type StockStatus = "Inativo" | "Sem estoque" | "Estoque baixo" | "Em estoque";

export function stockStatus(stock: number, min: number, active = true): StockStatus {
  if (!active) return "Inativo";
  if (stock === 0) return "Sem estoque";
  if (stock <= min) return "Estoque baixo";
  return "Em estoque";
}

/** Returns the error message for an entry/exit, or null when it is allowed. Stock never goes negative. */
export function movementError(type: "Entrada" | "Saída", qty: number, available: number): string | null {
  if (type === "Saída" && qty > available)
    return `Saída não permitida. O estoque disponível é de ${available} unidades.`;
  if (qty < 1) return "Informe uma quantidade maior que zero.";
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

export function formatNow() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function formatPrice(price: number) {
  return `R$ ${price.toFixed(2).replace(".", ",")}`;
}
