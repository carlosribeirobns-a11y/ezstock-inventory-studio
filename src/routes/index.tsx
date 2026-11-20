import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button, Field, Icon } from "@/components/ezstock/ui";
import { ADMIN_EMAIL, roleForEmail } from "@/lib/ezstock/data";
import { ezHead } from "@/lib/ezstock/seo";
import { useEzStock } from "@/lib/ezstock/store";

export const Route = createFileRoute("/")({
  head: () =>
    ezHead(
      "Entrar",
      "Acesse o EzStock e organize o estoque do seu negócio: produtos, entradas, saídas e alertas em um só lugar.",
    ),
  component: Login,
});

function Login() {
  const { logged, login } = useEzStock();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("12345678");
  const [error, setError] = useState("");

  useEffect(() => {
    if (logged) navigate({ to: "/dashboard", replace: true });
  }, [logged, navigate]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError("Preencha o e-mail e a senha para continuar.");
    login(roleForEmail(email));
  };

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
        <p className="login-foot">© 2025 EzStock. Gestão inteligente para pequenos negócios.</p>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="mobile-logo"><div className="logo-mark"><Icon name="box" /></div><strong>EzStock</strong></div>
          <span className="eyebrow blue">BEM-VINDO DE VOLTA</span>
          <h2>Acesse sua conta</h2>
          <p>Use seus dados para entrar no painel da sua empresa.</p>
          <Field label="E-mail">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@empresa.com.br" type="email" />
          </Field>
          <Field label="Senha">
            <div className="password">
              <input value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} />
              <button type="button" onClick={() => setShow(!show)} aria-label="Exibir senha"><Icon name="eye" /></button>
            </div>
          </Field>
          {error && <div className="inline-error"><Icon name="alert" size={17} />{error}</div>}
          <div className="form-row between">
            <label className="check-row"><input type="checkbox" defaultChecked />Lembrar de mim</label>
            <button type="button" className="link-button">Esqueci minha senha</button>
          </div>
          <Button type="submit">Entrar no EzStock <Icon name="arrow" size={18} /></Button>
          <div className="demo-note">
            <strong>Acesso de demonstração</strong>
            <span>Use <b>{ADMIN_EMAIL}</b> para a visão administrativa. Qualquer outra conta acessa a visão do colaborador.</span>
          </div>
        </form>
      </section>
    </main>
  );
}
