import type { AppRole } from "./data";

export type AccountAuthority = { id: string; role: AppRole | null; isPrimary: boolean };
export type AccountTarget = AccountAuthority;
export function canManageAccount(actor: AccountAuthority, target: AccountTarget) {
  if (actor.role !== "admin" && actor.role !== "super_admin") return false;
  if (target.isPrimary) return actor.id === target.id && actor.isPrimary;
  return actor.isPrimary || target.role === "colaborador" || target.role === null;
}
export function canRemoveAccount(actor: AccountAuthority, target: AccountTarget) {
  return actor.id !== target.id && !target.isPrimary && canManageAccount(actor, target);
}
export function canAssignRole(actor: AccountAuthority, role: AppRole) {
  return (actor.role === "admin" || actor.role === "super_admin") && (role !== "super_admin" || actor.isPrimary);
}