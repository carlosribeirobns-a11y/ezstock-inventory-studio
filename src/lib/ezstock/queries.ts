import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, MovementType } from "./data";

export type Me = { id: string; email: string; fullName: string; role: AppRole | null; active: boolean; isPrimary: boolean; mustChangePassword: boolean };

export const meQuery = queryOptions({
  queryKey: ["me"],
  refetchInterval: 30000,
  queryFn: async (): Promise<Me | null> => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return null;
    const [{ data: profile }, { data: roles, error }] = await Promise.all([
      supabase.from("profiles").select("full_name, email, active, deleted_at").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role, is_primary_superadmin").eq("user_id", user.id),
    ]);
    if (error) throw error;
    const list = (roles ?? []).map((r) => r.role);
    const active = Boolean(profile?.active && !profile.deleted_at);
    const role: AppRole | null = !active ? null : list.includes("super_admin") ? "super_admin" : list.includes("admin") ? "admin" : list.includes("colaborador") ? "colaborador" : null;
    return {
      id: user.id,
      email: profile?.email || user.email || "",
      fullName: profile?.full_name || user.email || "",
      role,
      active,
      isPrimary: (roles ?? []).some((r) => r.is_primary_superadmin),
      mustChangePassword: user.app_metadata?.["must_change_password"] === true,
    };
  },
});

export type Product = {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  category: string;
  supplier_id: string | null;
  supplier: string;
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
      .select("id, name, sku, category_id, supplier_id, stock, min_stock, price, active, created_at, categories(name), suppliers(name)")
      .is("deleted_at", null)
      .order("name");
    if (error) throw error;
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category_id: p.category_id,
      category: p.categories?.name ?? "Sem categoria",
      supplier_id: p.supplier_id,
      supplier: p.suppliers?.name ?? "—",
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

export type TeamMember = { id: string; fullName: string; email: string; role: AppRole | null; active: boolean; isPrimary: boolean };

/** Admin-only list (non-admins only see their own role row). */
export const teamQuery = queryOptions({
  queryKey: ["team"],
  queryFn: async (): Promise<TeamMember[]> => {
    const [{ data: profiles, error }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, active").is("deleted_at", null).order("full_name"),
      supabase.from("user_roles").select("user_id, role, is_primary_superadmin"),
    ]);
    if (error) throw error;
    if (rolesError) throw rolesError;
    return (profiles ?? []).map((p) => {
      const mine = (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
      return {
        id: p.id,
        fullName: p.full_name || p.email,
        email: p.email,
        role: mine.includes("super_admin") ? "super_admin" : mine.includes("admin") ? "admin" : mine.includes("colaborador") ? "colaborador" : null,
        active: p.active,
        isPrimary: (roles ?? []).some((r) => r.user_id === p.id && r.is_primary_superadmin),
      };
    });
  },
});

export type AdjustmentRequest = {
  id: string;
  product_id: string;
  product: string;
  sku: string;
  counted: number;
  system_stock: number;
  reason: string;
  status: "pendente" | "aprovado" | "recusado";
  requested_by: string | null;
  requester: string;
  reviewer: string;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

/** Admins see every request; collaborators only their own (RLS). */
export const adjustmentRequestsQuery = queryOptions({
  queryKey: ["adjustment-requests"],
  refetchInterval: 30000,
  queryFn: async (): Promise<AdjustmentRequest[]> => {
    const { data, error } = await supabase
      .from("adjustment_requests")
      .select(
        "id, product_id, counted, system_stock, reason, status, requested_by, review_note, reviewed_at, created_at, products(name, sku), requester:profiles!adjustment_requests_requested_by_fkey(full_name), reviewer:profiles!adjustment_requests_reviewed_by_fkey(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      product_id: r.product_id,
      product: r.products?.name ?? "—",
      sku: r.products?.sku ?? "",
      counted: r.counted,
      system_stock: r.system_stock,
      reason: r.reason,
      status: r.status,
      requested_by: r.requested_by,
      requester: r.requester?.full_name || "—",
      reviewer: r.reviewer?.full_name || "",
      review_note: r.review_note,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
    }));
  },
});
