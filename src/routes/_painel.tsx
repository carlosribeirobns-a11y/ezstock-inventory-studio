import { useEffect, useState } from "react";
import { createFileRoute, Navigate, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Icon, useGo } from "@/components/ezstock/ui";
import { collaboratorPages, nav, pagePath } from "@/lib/ezstock/data";
import { useEzStock } from "@/lib/ezstock/store";

/** Signed-in panel: sidebar, top bar and the current screen. Logged-out visitors go back to the login. */
export const Route = createFileRoute("/_painel")({
  component: PainelLayout,
});

function PainelLayout() {
  const { logged, role, currentUser, initials, toast, logout } = useEzStock();
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const go = useGo();
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => setMobileNav(false), [pathname]);

  if (!logged) return <Navigate to="/" replace />;

  const visibleNav = role === "Administrador" ? nav : nav.filter((item) => collaboratorPages.includes(item.id));
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
          <span>Acesse nossa central de suporte.</span>
          <button>Ver central de ajuda</button>
        </div>
        <button
          className="logout"
          onClick={() => {
            logout();
            navigate({ to: "/" });
          }}
        >
          <Icon name="logout" />Sair da conta
        </button>
      </aside>
      {mobileNav && <div className="nav-overlay" onClick={() => setMobileNav(false)} />}
      <div className="main-wrap">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Icon name="menu" /></button>
          <div className="breadcrumb"><span>EzStock</span><Icon name="arrow" size={14} /><strong>{current?.label}</strong></div>
          <div className="top-actions">
            <button className="notification" aria-label="Notificações"><Icon name="bell" /><i /></button>
            <div className="user-menu"><div>{initials}</div><span><strong>{currentUser}</strong><small>{role}</small></span></div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      {toast && <div className="toast" role="status"><span><Icon name="check" size={16} /></span>{toast}</div>}
    </div>
  );
}
