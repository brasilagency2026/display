import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, Button, Notice, PageHeader, inputClass } from "../../components/admin/ui";
import { errorMessage } from "../../lib/errors";

function StockRow({
  variantId,
  productName,
  variantName,
  sku,
  quantity,
  threshold,
  managed,
}: {
  variantId: Id<"productVariants">;
  productName: string;
  variantName: string;
  sku: string | null;
  quantity: number;
  threshold: number;
  managed: boolean;
}) {
  const setStock = useMutation(api.admin.setVariantStock);
  const [value, setValue] = useState(String(quantity));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const valid = /^\d+$/.test(value);
  const changed = valid && Number(value) !== quantity;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await setStock({ variantId, newQuantity: Number(value) });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{productName}</p>
        <p className="text-sm text-slate-500">{variantName}{sku ? ` · SKU ${sku}` : ""}</p>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </div>
      {!managed && <Badge tone="gray">Sem controle de estoque</Badge>}
      {managed && quantity <= threshold && <Badge tone="amber">Estoque baixo</Badge>}
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Estoque de {productName} {variantName}</span>
        <input
          className={`${inputClass} w-24`}
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <Button onClick={() => void save()} disabled={!changed || saving}>{saving ? "Salvando…" : "Salvar"}</Button>
    </li>
  );
}

export default function Stock() {
  const rows = useQuery(api.admin.listStock);
  return (
    <div>
      <PageHeader title="Estoque" />
      <Notice kind="info">Cada alteração é registrada no histórico de movimentações.</Notice>
      <div className="mt-4">
        {rows === undefined ? (
          <p className="text-slate-500" role="status">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-slate-600">Nenhuma opção de produto cadastrada.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {rows.map((row) => (
              <StockRow
                key={`${row.variantId}-${row.stockQuantity}`}
                variantId={row.variantId}
                productName={row.productName}
                variantName={row.variantName}
                sku={row.sku}
                quantity={row.stockQuantity}
                threshold={row.lowStockThreshold}
                managed={row.stockManaged}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
