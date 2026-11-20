import { useSuspenseQuery } from "@tanstack/react-query";
import type { AppRole } from "./data";
import { meQuery, type Me } from "./queries";

/** Signed-in member inside the panel (the panel layout guarantees a user with a role). */
export function useMe(): Me & { role: AppRole; isAdmin: boolean } {
  const { data } = useSuspenseQuery(meQuery);
  const me = data ?? { id: "", email: "", fullName: "", role: null };
  const role: AppRole = me.role ?? "colaborador";
  return { ...me, role, isAdmin: role === "admin" };
}
