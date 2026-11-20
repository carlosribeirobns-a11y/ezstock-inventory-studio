import { createFileRoute } from "@tanstack/react-router";
import { EntityPage } from "@/components/ezstock/entity-page";
import { ezHead } from "@/lib/ezstock/seo";

export const Route = createFileRoute("/_painel/categorias")({
  head: () => ezHead("Categorias", "Organize os produtos da loja em categorias para facilitar a gestão do estoque."),
  component: () => <EntityPage type="categorias" />,
});
