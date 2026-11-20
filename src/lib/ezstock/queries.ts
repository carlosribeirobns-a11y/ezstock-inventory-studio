import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, MovementType } from "./data";

export type Me = { id: string; email: string; fullName: string; role: AppRole | null };

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return null;
    const [{ data: profile }, { data: roles, error }] = await Promise.all([
      supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    if (error) throw error;
    const list = (roles ?? []).map((r) => r.role);
    const role: AppRole | null = list.includes("admin") ? "admin" : list.includes("colaborador") ? "colaborador" : null;
    return {
      id: user.id,
      email: profile?.email || user.email || "",
      fullName: profile?.full_name || user.email || "",
      role,
    };
  },
});

export type Product = {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  category: string;
  stock: number;
  min_stock: number;
  price: number;
  active: boolean;
  created_at: string;
};

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, category_id, stock, min_stock, price, active, created_at, categories(name)")
      .order("name");
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category_id: p.category_id,
      category: p.categories?.name ?? "Sem categoria",
      stock: p.stock,
      min_stock: p.min_stock,
      price: Number(p.price),
      active: p.active,
      created_at: p.created_at,
    }));
  },
});

export type Movement = {
  id: string;
  product_id: string;
  product: string;
  sku: string;
  price: number;
  type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string | null;
  note: string | null;
  movement_date: string;
  user: string;
  created_at: string;
};

export const movementsQuery = queryOptions({
  queryKey: ["movements"],
  queryFn: async (): Promise<Movement[]> => {
    const { data, error } = await supabase
      .from("movements")
      .select(
        "id, product_id, type, quantity, previous_stock, new_stock, reason, note, movement_date, created_at, products(name, sku, price), profiles(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []).map((m) => ({
      id: m.id,
      product_id: m.product_id,
      product: m.products?.name ?? "—",
      sku: m.products?.sku ?? "",
      price: Number(m.products?.price ?? 0),
      type: m.type,
      quantity: m.quantity,
      previous_stock: m.previous_stock,
      new_stock: m.new_stock,
      reason: m.reason,
      note: m.note,
      movement_date: m.movement_date,
      user: m.profiles?.full_name || "Sistema",
      created_at: m.created_at,
    }));
  },
});

export type Category = { id: string; name: string; active: boolean; productCount: number };

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase.from("categories").select("id, name, active, products(count)").order("name");
    if (error) throw error;
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      active: c.active,
      productCount: (c.products as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
    }));
  },
});

export type Supplier = { id: string; name: string; phone: string; email: string };

export const suppliersQuery = queryOptions({
  queryKey: ["suppliers"],
  queryFn: async (): Promise<Supplier[]> => {
    const { data, error } = await supabase.from("suppliers").select("id, name, phone, email").order("name");
    if (error) throw error;
    return data ?? [];
  },
});

export type TeamMember = { id: string; fullName: string; email: string; role: AppRole | null };

/** Admin-only list (non-admins only see their own role row). */
export const teamQuery = queryOptions({
  queryKey: ["team"],
  queryFn: async (): Promise<TeamMember[]> => {
    const [{ data: profiles, error }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw error;
    if (rolesError) throw rolesError;
    return (profiles ?? []).map((p) => {
      const mine = (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
      return {
        id: p.id,
        fullName: p.full_name || p.email,
        email: p.email,
        role: mine.includes("admin") ? "admin" : mine.includes("colaborador") ? "colaborador" : null,
      };
    });
  },
});
