import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ImageBox } from "../components/ImageBox";
import { ShippingQuote } from "../components/ShippingQuote";
import type { SelectedShipping } from "../components/ShippingQuote";
import { useTitle } from "../hooks/useTitle";
import { useCart } from "../lib/cart";
import { formatBRL } from "../lib/format";
import { MAX_QUANTITY } from "../../shared/pricing";

export default function Cart() {
  useTitle("Carrinho");
  const cart = useCart();
  const [shipping, setShipping] = useState<SelectedShipping | null>(null);
  const priced = useQuery(api.catalog.priceCart, cart.items.length > 0 ? { items: cart.items } : "skip");

  if (cart.items.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Carrinho</h1>
        <p className="rounded-xl bg-slate-50 p-6 text-slate-600">Seu carrinho está vazio.</p>
        <Link to="/loja" className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white">
          Ver modelos
        </Link>
      </section>
    );
  }

  const hasProblem = priced?.lines.some((line) => line.problem) ?? true;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Carrinho</h1>

      {priced === undefined ? (
        <p className="text-slate-500" role="status">Atualizando preços…</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {priced.lines.map((line, index) => {
              const item = cart.items[index];
              return (
                <li key={`${line.productId}-${line.variantId}-${line.designId}`} className="flex gap-4 p-4">
                  <ImageBox src={line.imageUrl} alt={line.name} className="h-20 w-20 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">{line.name}</p>
                    {line.variantName && <p className="text-sm text-slate-500">{line.variantName}</p>}
                    {line.designName && <p className="text-sm text-slate-500">Design: {line.designName}</p>}
                    {line.problem && <p className="text-sm text-red-700" role="alert">{line.problem}</p>}

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <label className="flex items-center gap-2 text-sm">
                        Qtd.
                        <input
                          type="number"
                          min={1}
                          max={MAX_QUANTITY}
                          value={item.quantity}
                          onChange={(event) => cart.setQuantity(item, Math.floor(Number(event.target.value)))}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => cart.remove(item)}
                        className="text-sm text-red-700 underline"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {!line.problem && (
                      <>
                        <p className="font-semibold">{formatBRL(line.lineTotalCents)}</p>
                        <p className="text-slate-500">{formatBRL(line.unitPriceCents)} cada</p>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="h-fit space-y-4 rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold">Resumo</h2>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">{formatBRL(priced.subtotalCents)}</span>
            </div>
            <ShippingQuote items={cart.items} disabled={hasProblem} onSelect={setShipping} />
            {shipping && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Frete (Correios {shipping.service})</span>
                  <span>{formatBRL(shipping.priceCents)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 font-semibold">
                  <span>Total</span>
                  <span>{formatBRL(priced.subtotalCents + shipping.priceCents)}</span>
                </div>
              </>
            )}
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg bg-slate-300 px-4 py-3 font-medium text-white"
            >
              Finalizar pedido
            </button>
            <p className="text-xs text-slate-500">
              {hasProblem
                ? "Corrija os itens indicados para continuar."
                : "A finalização do pedido será liberada em breve."}
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
