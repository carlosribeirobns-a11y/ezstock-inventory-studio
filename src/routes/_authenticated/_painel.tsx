import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Icon, Status, useGo } from "@/components/ezstock/ui";
import { collaboratorPages, initialsOf, nav, pagePath, roleLabel } from "@/lib/ezstock/data";
import { meQuery, productsQuery } from "@/lib/ezstock/queries";

/** Signed-in panel: sidebar, top bar and the current screen. */
export const Route = createFileRoute("/_authenticated/_painel")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  pendingComponent: PanelLoading,
  component: PainelLayout,
});

function PanelLoading() {
  return <div className="panel-loading"><div className="logo-mark"><Icon name="box" size={22} /></div></div>;
}

function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function PainelLayout() {
  const { data: me } = useSuspenseQuery(meQuery);
  const pathname = useLocation({ select: (l) => l.pathname });
  const go = useGo();
  const signOut = useSignOut();
  const [mobileNav, setMobileNav] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => { setMobileNav(false); setUserMenu(false); }, [pathname]);

  if (!me?.role) {
    return (
      <main className="login-page single">
        <section className="login-form-wrap">
          <div className="login-form">
            <div className="mobile-logo show"><div className="logo-mark"><Icon name="box" /></div><strong>EzStock</strong></div>
            <span className="eyebrow blue">ACESSO PENDENTE</span>
            <h2>Sua conta ainda não tem acesso</h2>
            <p>Peça ao administrador da loja para definir seu perfil de acesso na tela Usuários.</p>
            <button className="btn secondary" onClick={signOut}><Icon name="logout" size={18} />Sair da conta</button>
          </div>
        </section>
      </main>
    );
  }

  const isAdmin = me.role === "admin";
  const visibleNav = isAdmin ? nav : nav.filter((item) => collaboratorPages.includes(item.id));
  const current = nav.find((n) => pagePath[n.id] === pathname);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand-lockup sidebar-brand">
          <div className="logo-mark"><Icon name="box" size={22} /></div>
          <strong>EzStock</strong>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><Icon name="close" /></button>
        </div>
        <div className="company"><div>PB</div><span><strong>Ponto da Beleza</strong><small>Loja de variedades</small></span></div>
        <nav>
          {visibleNav.map((item) => (
            <button key={item.id} className={current?.id === item.id ? "active" : ""} onClick={() => go(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-help">
          <Icon name="alert" />
          <strong>Precisa de ajuda?</strong>
          <span>{isAdmin ? "Crie e gerencie as contas da equipe em Usuários." : "Fale com o administrador da loja."}</span>
        </div>
        <button className="logout" onClick={signOut}><Icon name="logout" />Sair da conta</button>
      </aside>
      {mobileNav && <div className="nav-overlay" onClick={() => setMobileNav(false)} />}
      <div className="main-wrap">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Icon name="menu" /></button>
          <div className="breadcrumb"><span>EzStock</span><Icon name="arrow" size={14} /><strong>{current?.label}</strong></div>
          <div className="top-actions">
            <Notifications />
            <div className="user-menu-wrap">
              <button className="user-menu user-menu-trigger" onClick={() => setUserMenu((v) => !v)} aria-label="Menu do usuário" aria-expanded={userMenu}><div>{initialsOf(me.fullName)}</div><span><strong>{me.fullName}</strong><small>{roleLabel[me.role]}</small></span><Icon name="chevron" size={16} /></button>
              {userMenu && (<>
                <div className="user-dropdown-backdrop" onClick={() => setUserMenu(false)} />
                <div className="user-dropdown" role="menu"><button role="menuitem" onClick={signOut}><Icon name="logout" size={16} />Sair da conta</button></div>
              </>)}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Notifications() {
  const { data: products = [] } = useQuery(productsQuery);
  const go = useGo();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const alerts = products.filter((p) => p.active && p.stock <= p.min_stock).sort((a, b) => a.stock - b.stock);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="notification" aria-label={`Alertas de estoque (${alerts.length})`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="bell" />
        {alerts.length > 0 && <i />}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Alertas de estoque">
          <header><strong>Alertas de estoque</strong><span>{alerts.length}</span></header>
          {alerts.length ? (
            alerts.slice(0, 8).map((p) => (
              <button key={p.id} onClick={() => { setOpen(false); go("produtos"); }}>
                <div><strong>{p.name}</strong><small>{p.stock} un. · mín. {p.min_stock}</small></div>
                <Status stock={p.stock} min={p.min_stock} />
              </button>
            ))
          ) : (
            <div className="mini-empty">Nenhum produto precisa de reposição.</div>
          )}
        </div>
      )}
    </div>
  );
}
