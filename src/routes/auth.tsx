import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button, Field, Icon } from "@/components/ezstock/ui";
import { ezHead } from "@/lib/ezstock/seo";
import { setupFirstAdmin } from "@/lib/ezstock/team.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () =>
    ezHead("Entrar", "Acesse sua conta EzStock para acompanhar produtos, entradas, saídas e alertas de estoque."),
  component: AuthPage,
});

type Mode = "signin" | "forgot" | "setup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session) navigate({ to: "/dashboard", replace: true });
    });
    supabase.rpc("needs_setup").then(({ data }) => {
      if (!alive) return;
      setNeedsSetup(Boolean(data));
      if (data) setMode("setup");
    });
    return () => {
      alive = false;
    };
  }, [navigate]);

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-lockup"><div className="logo-mark"><Icon name="box" size={26} /></div><strong>EzStock</strong></div>
        <div className="brand-copy">
          <span className="eyebrow">Estoque simples. Negócio no controle.</span>
          <h1>Organize seu estoque e tome decisões com confiança.</h1>
          <p>Acompanhe produtos, entradas e saídas em um só lugar. Simples de usar, fácil de controlar.</p>
          <div className="feature-list">
            <span><Icon name="check" />Visão completa do estoque</span>
            <span><Icon name="check" />Alertas antes de faltar produto</span>
            <span><Icon name="check" />Histórico seguro e organizado</span>
          </div>
        </div>
        <p className="login-foot">© {new Date().getFullYear()} EzStock. Gestão inteligente para pequenos negócios.</p>
      </section>
      <section className="login-form-wrap">
        {mode === "setup" && needsSetup ? (
          <SetupForm onDone={() => navigate({ to: "/dashboard", replace: true })} />
        ) : mode === "forgot" ? (
          <ForgotForm onBack={() => setMode("signin")} />
        ) : (
          <SignInForm onForgot={() => setMode("forgot")} onSignedIn={() => navigate({ to: "/dashboard", replace: true })} />
        )}
      </section>
    </main>
  );
}

function FormShell({ eyebrow, title, text, children, onSubmit }: { eyebrow: string; title: string; text: string; children: ReactNode; onSubmit: (e: FormEvent) => void }) {
  return (
    <form className="login-form" onSubmit={onSubmit}>
      <div className="mobile-logo"><div className="logo-mark"><Icon name="box" /></div><strong>EzStock</strong></div>
      <span className="eyebrow blue">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </form>
  );
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password">
      <input value={value} onChange={(e) => onChange(e.target.value)} type={show ? "text" : "password"} autoComplete={autoComplete} required />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar senha" : "Exibir senha"}><Icon name="eye" /></button>
    </div>
  );
}

function SignInForm({ onForgot, onSignedIn }: { onForgot: () => void; onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError("Preencha o e-mail e a senha para continuar.");
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) return setError(/invalid/i.test(err.message) ? "E-mail ou senha incorretos." : err.message);
    onSignedIn();
  };

  return (
    <FormShell eyebrow="BEM-VINDO DE VOLTA" title="Acesse sua conta" text="Use seus dados para entrar no painel da sua empresa." onSubmit={submit}>
      <Field label="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@empresa.com.br" type="email" autoComplete="email" required /></Field>
      <Field label="Senha"><PasswordInput value={password} onChange={setPassword} autoComplete="current-password" /></Field>
      {error && <div className="inline-error"><Icon name="alert" size={17} />{error}</div>}
      <div className="form-row between">
        <span />
        <button type="button" className="link-button" onClick={onForgot}>Esqueci minha senha</button>
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar no EzStock"} <Icon name="arrow" size={18} /></Button>
      <div className="demo-note">
        <strong>Ainda não tem acesso?</strong>
        <span>As contas são criadas pelo administrador da loja na tela Usuários.</span>
      </div>
    </FormShell>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setSent(true);
  };

  return (
    <FormShell eyebrow="RECUPERAR ACESSO" title="Esqueceu a senha?" text="Informe seu e-mail e enviaremos um link para criar uma nova senha." onSubmit={submit}>
      {sent ? (
        <div className="info-strip success-strip"><Icon name="check" />Se houver uma conta com este e-mail, você receberá o link em instantes. Confira também a caixa de spam.</div>
      ) : (
        <>
          <Field label="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="seuemail@empresa.com.br" autoComplete="email" required /></Field>
          {error && <div className="inline-error"><Icon name="alert" size={17} />{error}</div>}
          <div className="form-row" />
          <Button type="submit" disabled={busy}>{busy ? "Enviando..." : "Enviar link"}</Button>
        </>
      )}
      <div className="form-row"><button type="button" className="link-button" onClick={onBack}>Voltar para o login</button></div>
    </FormShell>
  );
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    setBusy(true);
    setError("");
    try {
      await setupFirstAdmin({ data: { fullName, email, password } });
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (err) throw err;
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell eyebrow="PRIMEIRO ACESSO" title="Crie a conta do administrador" text="Esta conta gerencia produtos, relatórios e a equipe. Depois, você cria as contas dos colaboradores." onSubmit={submit}>
      <Field label="Nome completo"><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex.: Marina Souza" autoComplete="name" required /></Field>
      <Field label="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="seuemail@empresa.com.br" autoComplete="email" required /></Field>
      <Field label="Senha" hint="Mínimo de 8 caracteres."><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" /></Field>
      {error && <div className="inline-error"><Icon name="alert" size={17} />{error}</div>}
      <div className="form-row" />
      <Button type="submit" disabled={busy}>{busy ? "Criando conta..." : "Criar conta e entrar"} <Icon name="arrow" size={18} /></Button>
    </FormShell>
  );
}
