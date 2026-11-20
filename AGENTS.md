<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- EzStock data lives in Lovable Cloud tables (profiles, user_roles, categories, suppliers, products, movements); browser code reads them through React Query `queryOptions` in `src/lib/ezstock/queries.ts`, with route loaders calling `ensureQueryData` and components `useSuspenseQuery`.
- Stock only changes through the `register_movement` / `adjust_inventory` database functions (products.stock has no client UPDATE grant and movements has no client write grant), so the balance can never go negative and history stays append-only.
- Roles and the protected primary-superadministrator flag live in `user_roles`; RLS helpers require an active, nondeleted profile and treat superadministrators as admins. Account creation/deletion uses authenticated server functions; atomic role/status changes use `manage_team_account` so permissions cannot be bypassed or raced. Public sign-up is disabled.
- Account deletion revokes access before soft-deleting the auth identity and retains the profile for immutable movement attribution; never delete stock history to remove an account.
- Signed-in screens live under `_authenticated` (client-only gate, redirects to `/auth`) and the nested pathless `_painel` layout (sidebar/top bar); keep one route file per screen.
- Pure stock and report rules live in `src/lib/ezstock/data.ts` and `reports.ts` so they can be unit-tested; screens call them instead of inlining checks.
- Visual styling is plain CSS classes in `src/styles.css` ported from the prototype, using the oklch tokens defined in `:root`; reuse those classes rather than adding ad hoc colors.
