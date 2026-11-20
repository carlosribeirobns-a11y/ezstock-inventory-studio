import { useState } from "react";
import { entityData } from "@/lib/ezstock/data";
import { useEzStock } from "@/lib/ezstock/store";
import { Button, Field, Icon, Modal, PageHead, RestrictedCard } from "./ui";

type EntityType = "categorias" | "fornecedores" | "usuarios";

const configs = {
  categorias: { title: "Categorias", subtitle: "Organize os produtos em categorias para facilitar a gestão.", singular: "categoria" },
  fornecedores: { title: "Fornecedores", subtitle: "Mantenha os dados de contato dos seus parceiros comerciais.", singular: "fornecedor" },
  usuarios: { title: "Usuários", subtitle: "Gerencie acessos e permissões da equipe.", singular: "usuário" },
};

export function EntityPage({ type }: { type: EntityType }) {
  const { role, notify } = useEzStock();
  const config = configs[type];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rows = entityData[type].filter((r) => r.join(" ").toLowerCase().includes(query.toLowerCase()));
  const restricted = role === "Colaborador";

  return (
    <>
      <PageHead title={config.title} subtitle={config.subtitle} action={!restricted ? <Button icon="plus" onClick={() => setOpen(true)}>Novo {config.singular}</Button> : undefined} />
      {restricted && type === "usuarios" ? (
        <RestrictedCard text="Somente administradores podem visualizar e gerenciar usuários e permissões." />
      ) : (
        <section className="card table-card">
          <div className="toolbar">
            <div className="search">
              <Icon name="search" size={18} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar ${config.title.toLowerCase()}...`} />
            </div>
            <span className="result-count">{rows.length} registros</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{type === "categorias" ? "Categoria" : type === "usuarios" ? "Nome" : "Fornecedor"}</th>
                  <th>{type === "categorias" ? "Produtos vinculados" : type === "usuarios" ? "E-mail" : "Telefone"}</th>
                  <th>{type === "categorias" ? "Status" : type === "usuarios" ? "Perfil" : "E-mail"}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r[0]}>
                    <td><strong>{r[0]}</strong></td>
                    <td>{r[1]}</td>
                    <td>
                      {type === "categorias" ? (
                        <span className="badge success"><i />{r[2]}</span>
                      ) : type === "usuarios" ? (
                        <span className={`role-badge ${r[2] === "Administrador" ? "admin" : ""}`}>{r[2]}</span>
                      ) : (
                        r[2]
                      )}
                    </td>
                    <td>
                      <button className="icon-button" onClick={() => !restricted && setOpen(true)} aria-label={restricted ? "Visualizar" : "Editar"}>
                        <Icon name={restricted ? "eye" : "edit"} size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {open && (
        <Modal title={`Cadastrar ${config.singular}`} subtitle={`Informe os dados do novo ${config.singular}.`} onClose={() => setOpen(false)}>
          <form
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              setOpen(false);
              notify(`${config.title.slice(0, -1)} cadastrado com sucesso.`);
            }}
          >
            <div className="form-grid">
              <Field label="Nome"><input required placeholder={`Nome do ${config.singular}`} /></Field>
              {type !== "categorias" && <Field label="E-mail"><input required type="email" placeholder="contato@empresa.com.br" /></Field>}
              {type === "fornecedores" && <Field label="Telefone"><input placeholder="(00) 00000-0000" /></Field>}
              {type === "usuarios" && (
                <Field label="Perfil de acesso">
                  <select><option>Colaborador</option><option>Administrador</option></select>
                </Field>
              )}
            </div>
            {type === "usuarios" && (
              <div className="info-strip"><Icon name="alert" />Colaboradores podem consultar produtos e registrar movimentações, mas não gerenciam cadastros.</div>
            )}
            <footer>
              <span />
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
