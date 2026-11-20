import { describe, expect, it } from "vitest";
import { adjustmentNeedsApproval, canDeleteProduct } from "@/lib/ezstock/data";

describe("exclusão de produto", () => {
  it("permite excluir produto inativo com saldo zero", () => {
    expect(canDeleteProduct({ active: false, stock: 0 })).toBe(true);
  });
  it("bloqueia produto ativo ou com saldo", () => {
    expect(canDeleteProduct({ active: true, stock: 0 })).toBe(false);
    expect(canDeleteProduct({ active: false, stock: 3 })).toBe(false);
  });
});

describe("aprovação de ajustes", () => {
  it("colaborador precisa de aprovação; administradores não", () => {
    expect(adjustmentNeedsApproval("colaborador")).toBe(true);
    expect(adjustmentNeedsApproval("admin")).toBe(false);
    expect(adjustmentNeedsApproval("super_admin")).toBe(false);
  });
});
