import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "../../components/admin/ui";
import { formatBRL } from "../../lib/format";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function Dashboard() {
  const data = useQuery(api.admin.dashboard);
  if (data === undefined) return <p className="text-slate-500" role="status">Carregando…</p>;

  return (
    <div>
      <PageHeader title="Painel" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Produtos publicados" value={data.products.published} hint={`${data.products.total} no total`} />
        <Stat label="Designs publicados" value={data.designs.published} hint={`${data.designs.total} no total`} />
        <Stat label="Aguardando pagamento" value={data.orders.pendingPayment} />
        <Stat label="Pagamentos aprovados" value={data.orders.approved} />
        <Stat label="Faturamento aprovado" value={formatBRL(data.orders.revenueCents)} />
      </div>

      {data.orders.total === 0 && (
        <p className="mt-6 rounded-xl bg-white p-5 text-slate-600">Nenhum pedido ainda.</p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Estoque baixo</h2>
        {data.lowStock.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-slate-600">Nenhum item com estoque baixo.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {data.lowStock.map((item) => (
              <li key={item.variantId} className="flex justify-between p-4 text-sm">
                <span>{item.productName} · {item.variantName}</span>
                <span className="font-medium">{item.stockQuantity} un.</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/admin/estoque" className="mt-2 inline-block text-sm text-indigo-700 underline">Gerenciar estoque</Link>
      </section>
    </div>
  );
}
