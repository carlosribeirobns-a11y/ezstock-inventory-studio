import { createFileRoute } from "@tanstack/react-router";
import { EntityPage } from "@/components/ezstock/entity-page";
import { ezHead } from "@/lib/ezstock/seo";

export const Route = createFileRoute("/_painel/usuarios")({
  head: () => ezHead("Usuários", "Gerencie os acessos e permissões da equipe no EzStock."),
  component: () => <EntityPage type="usuarios" />,
});
