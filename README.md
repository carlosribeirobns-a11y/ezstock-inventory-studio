# EzStock — Sistema de Gestão e Controle de Estoque

O **EzStock** é uma aplicação web full-stack desenvolvida para o controle centralizado, seguro e rastreável de estoque e inventário. O sistema implementa governança de acesso em múltiplos níveis, integridade transacional de saldos, histórico imutável para auditoria e fluxo de aprovação de ajustes operacionais.

**Aplicação publicada:** https://ezstock.dev

---

## 1. Descrição do Sistema

- **Autenticação e Controle de Acesso (RBAC):**
  - **Superadministrador:** perfil mestre protegido contra exclusão ou rebaixamento; gerencia credenciais, redefine senhas e administra os demais gestores.
  - **Administrador:** gerencia produtos, categorias, fornecedores e colaboradores, e aprova/recusa solicitações de ajuste.
  - **Colaborador:** registra movimentações (entradas/saídas/perdas) e envia solicitações de ajuste de inventário para aprovação.
- **Catálogo de Produtos:** código, categoria, fornecedor, preço de custo, preço de venda e estoque mínimo. Produtos inativos com saldo zero podem ser excluídos; quando há histórico, são arquivados (soft delete) para preservar a auditoria.
- **Categorias e Fornecedores:** contagem de produtos vinculados e listagem dos itens associados.
- **Movimentações de Estoque:** registro append-only de entradas, saídas e perdas, com bloqueio de saldo negativo.
- **Ajustes de Inventário com Aprovação:** solicitações de colaboradores ficam pendentes até aprovação ou recusa (com justificativa) por um administrador; administradores podem ajustar diretamente.
- **Histórico e Relatórios:** valor total em estoque, itens críticos, indicadores e exportação em CSV.

---

## 2. Tecnologias e Versões Utilizadas

### Frontend e Framework Full-Stack
- **React** `19.2`
- **TanStack Start** `1.168.60` (SSR e Server Functions)
- **TanStack React Router** `1.170.41` (roteamento por arquivos, type-safe)
- **TanStack React Query** `5.101`
- **Vite** `8.1.5`
- **Tailwind CSS** `4.2` (tokens de cor OKLCH)
- **Radix UI** `1.x` / `2.x`
- **Lucide React** `0.575`
- **Recharts** `2.15`
- **Sonner** `2.0`
- **Zod** `3.25`

### Backend, Banco de Dados e Segurança (Lovable Cloud)
- **PostgreSQL** com integridade referencial estrita
- **Row Level Security (RLS)** em todas as tabelas
- **Funções atômicas (SECURITY DEFINER):** `register_movement`, `adjust_inventory`, `request_adjustment`, `review_adjustment`, `delete_product`, `manage_team_account`
- **Supabase JS Client** `2.119`

### Qualidade de Código e Testes
- **TypeScript** `5.8` (modo estrito)
- **Vitest** `4.1`
- **Testing Library React** `16.0` / **JSDOM** `20.0`
- **ESLint** `9.32` / **Prettier** `3.7`

---

## 3. Instalação e Execução Local

### Pré-requisitos
- **Node.js** `20.x` ou superior (ou **Bun** `1.2+`)
- **Git**

### Passo a passo

1. Clonar o repositório:
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd <NOME_DA_PASTA>
   ```
2. Instalar as dependências:
   ```bash
   npm install
   # ou
   bun install
   ```
3. Configurar o arquivo `.env` na raiz (chaves públicas do backend):
   ```env
   VITE_SUPABASE_URL="https://agegjztetmvfqqrhlpbs.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_XmGN6VtvJS40f0c86Xye5g_evczcPyd"
   VITE_SUPABASE_PROJECT_ID="agegjztetmvfqqrhlpbs"
   ```
4. Iniciar o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse o endereço indicado no terminal (padrão: `http://localhost:8080`).
5. Executar os testes:
   ```bash
   npm test
   ```
6. Gerar a versão de produção:
   ```bash
   npm run build
   npm run preview
   ```

---

## 4. Orientações para Análise do Código

### 4.1. Estrutura de Diretórios
- `src/routes/` — telas e roteamento
  - `_authenticated/route.tsx`: proteção de acesso; redireciona não autenticados para `/auth`.
  - `_authenticated/_painel.tsx`: layout do painel (menu lateral, menu do usuário, verificação de perfil e troca obrigatória de senha).
  - `_authenticated/_painel/`: uma rota por tela (`dashboard`, `produtos`, `categorias`, `fornecedores`, `ajustes`, `movimentacoes`, `historico`, `relatorios`, `usuarios`).
  - `auth.tsx` e `reset-password.tsx`: login e recuperação de senha.
- `src/lib/ezstock/` — domínio e regras de negócio
  - `data.ts`: tipos e regras puras de estoque e exclusão de produtos.
  - `team-rules.ts`: matriz de permissões entre perfis.
  - `reports.ts`: cálculos de relatórios e indicadores.
  - `queries.ts`: `queryOptions` do React Query.
  - `team.functions.ts`: server functions de gestão de contas.
- `src/components/ezstock/` — componentes reutilizáveis (ex.: `linked-products.tsx`).
- `src/test/` — testes unitários de regras de estoque, permissões e rotas.
- `supabase/migrations/` — esquema do banco, políticas RLS e funções.

### 4.2. Destaques Arquiteturais
1. **Domínio testável:** regras críticas implementadas como funções puras em TypeScript, cobertas por testes sem depender do navegador.
2. **Saldo sempre consistente:** o cliente não altera `stock` nem grava em `movements` diretamente; tudo passa por funções transacionais com `SELECT ... FOR UPDATE`.
3. **RLS:** todas as tabelas aplicam Row Level Security conforme o perfil ativo.
4. **Carregamento previsível:** loaders com `ensureQueryData` e componentes com `useSuspenseQuery`.
