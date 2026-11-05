import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, Button, Notice, PageHeader } from "../../components/admin/ui";
import { errorMessage } from "../../lib/errors";
import { formatBRL } from "../../lib/format";

export default function Products() {
  const products = useQuery(api.adminCatalog.listProducts);
  const setFlags = useMutation(api.adminCatalog.setProductFlags);
  const [error, setError] = useState<string | null>(null);

  async function update(id: Id<"products">, flags: { active?: boolean; archived?: boolean }) {
    setError(null);
    try {
      await setFlags({ id, ...flags });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div>
      <PageHeader
        title="Produtos"
        action={<Link to="/admin/produtos/novo" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Novo produto</Link>}
      />
      {error && <Notice kind="error">{error}</Notice>}

      {products === undefined ? (
        <p className="text-slate-500" role="status">Carregando…</p>
      ) : products.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-slate-600">Nenhum produto cadastrado.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {products.map((product) => (
            <li key={product._id} className="flex flex-wrap items-center gap-3 p-4">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" className="h-14 w-14 rounded object-cover" />
              ) : (
                <div className="h-14 w-14 rounded bg-slate-100" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {product.name} {product.isDemo && <Badge tone="amber">DEMO</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  {formatBRL(product.basePriceCents)} · {product.variantCount} opções · estoque {product.totalStock}
                </p>
              </div>
              {product.archived ? (
                <Badge tone="gray">Arquivado</Badge>
              ) : (
                <Badge tone={product.active ? "green" : "gray"}>{product.active ? "Publicado" : "Oculto"}</Badge>
              )}
              <Link to={`/admin/produtos/${product._id}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:border-indigo-600">
                Editar
              </Link>
              {!product.archived && (
                <Button variant="secondary" onClick={() => void update(product._id, { active: !product.active })}>
                  {product.active ? "Ocultar" : "Publicar"}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => void update(product._id, { archived: !product.archived })}
              >
                {product.archived ? "Restaurar" : "Arquivar"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
