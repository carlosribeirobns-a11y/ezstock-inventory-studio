import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ezHead } from "@/lib/ezstock/seo";

// Sessions live in the browser, so this decision runs client-side only.
export const Route = createFileRoute("/")({
  ssr: false,
  head: () =>
    ezHead(
      "Gestão de estoque",
      "EzStock: organize o estoque do seu negócio com produtos, entradas, saídas, alertas e relatórios em um só lugar.",
    ),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/auth", replace: true });
  },
  component: () => null,
});
