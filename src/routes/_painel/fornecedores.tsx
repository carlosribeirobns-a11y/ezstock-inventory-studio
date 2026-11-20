import { createFileRoute } from "@tanstack/react-router";
import { EntityPage } from "@/components/ezstock/entity-page";
import { ezHead } from "@/lib/ezstock/seo";

export const Route = createFileRoute("/_painel/fornecedores")({
  head: () => ezHead("Fornecedores", "Contatos dos fornecedores e parceiros comerciais da sua loja."),
  component: () => <EntityPage type="fornecedores" />,
});
