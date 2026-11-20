import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button, Field, Icon } from "@/components/ezstock/ui";
import { ezHead } from "@/lib/ezstock/seo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ezHead("Nova senha", "Crie uma nova senha para acessar sua conta EzStock."),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session || isRecovery) setReady(Boolean(s.session) || isRecovery);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message);
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <main className="login-page single">
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="mobile-logo show"><div className="logo-mark"><Icon name="box" /></div><strong>EzStock</strong></div>
          <span className="eyebrow blue">NOVA SENHA</span>
          <h2>Crie uma nova senha</h2>
          <p>{ready ? "Escolha uma senha com pelo menos 8 caracteres." : "Abra esta página pelo link enviado ao seu e-mail."}</p>
          <Field label="Nova senha"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required disabled={!ready} /></Field>
          <Field label="Confirme a nova senha"><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required disabled={!ready} /></Field>
          {error && <div className="inline-error"><Icon name="alert" size={17} />{error}</div>}
          <div className="form-row" />
          <Button type="submit" disabled={!ready || busy}>{busy ? "Salvando..." : "Salvar nova senha"}</Button>
          <div className="form-row"><button type="button" className="link-button" onClick={() => navigate({ to: "/auth" })}>Voltar para o login</button></div>
        </form>
      </section>
    </main>
  );
}
