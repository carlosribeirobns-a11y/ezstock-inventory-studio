import { describe, expect, it } from "vitest";
import { canAssignRole, canManageAccount, canRemoveAccount } from "@/lib/ezstock/team-rules";

const primary = { id: "p", role: "super_admin" as const, isPrimary: true };
const admin = { id: "a", role: "admin" as const, isPrimary: false };
const otherAdmin = { id: "o", role: "admin" as const, isPrimary: false };
const collaborator = { id: "c", role: "colaborador" as const, isPrimary: false };

describe("team account permissions", () => {
  it("lets administrators deactivate or delete collaborators", () => expect(canRemoveAccount(admin, collaborator)).toBe(true));
  it("lets only the primary superadministrator delete administrators", () => {
    expect(canRemoveAccount(admin, otherAdmin)).toBe(false);
    expect(canRemoveAccount(primary, otherAdmin)).toBe(true);
  });
  it("lets only the primary superadministrator create superadministrators", () => {
    expect(canAssignRole(admin, "super_admin")).toBe(false);
    expect(canAssignRole(primary, "super_admin")).toBe(true);
  });
  it("protects the primary superadministrator", () => {
    expect(canManageAccount(admin, primary)).toBe(false);
    expect(canRemoveAccount(primary, primary)).toBe(false);
  });
});
import { canResetPassword } from "@/lib/ezstock/team-rules";
describe("password resets", () => {
  it("lets a superadministrator reset a collaborator's password", () => expect(canResetPassword(primary, collaborator)).toBe(true));
  it("does not let a regular administrator reset passwords", () => expect(canResetPassword(admin, collaborator)).toBe(false));
  it("does not let anyone reset the primary superadministrator's password", () => expect(canResetPassword({ id: "s", role: "super_admin", isPrimary: false }, primary)).toBe(false));
});
