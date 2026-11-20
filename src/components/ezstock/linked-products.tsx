import { Empty, Modal, Status } from "@/components/ezstock/ui";
import type { Product } from "@/lib/ezstock/queries";

/** Read-only list of the products linked to a category or supplier. */
export function LinkedProductsModal({ title, products, onClose }: { title: string; products: Product[]; onClose: () => void }) {
  return (
    <Modal title={title} subtitle={`${products.length} ${products.length === 1 ? "produto vinculado" : "produtos vinculados"}`} onClose={onClose}>
      {products.length ? (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Produto</th><th>Categoria</th><th>Fornecedor</th><th>Estoque</th><th>Status</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><div className="product-cell"><div className="product-thumb">{p.name[0]}</div><div><strong>{p.name}</strong><span>{p.sku}</span></div></div></td>
                  <td>{p.category}</td>
                  <td>{p.supplier}</td>
                  <td><strong>{p.stock}</strong> un.</td>
                  <td><Status stock={p.stock} min={p.min_stock} active={p.active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Nenhum produto vinculado" text="Vincule produtos pelo cadastro na tela de Produtos." />
      )}
    </Modal>
  );
}
