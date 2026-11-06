import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { CartItem } from "../lib/cart";
import { errorMessage } from "../lib/errors";
import { formatBRL, formatCEP } from "../lib/format";
import { getSessionRef } from "../lib/session";

type QuoteResult = FunctionReturnType<typeof api.shipping.quote>;

export interface SelectedShipping {
  quoteId: string;
  service: "PAC" | "SEDEX";
  priceCents: number;
}

interface Props {
  items: CartItem[];
  disabled: boolean;
  onSelect: (selected: SelectedShipping | null) => void;
}

/** Calcul du frete Correios PAC / SEDEX. Le prix affiché vient du serveur ; le navigateur n'envoie que le CEP et le panier. */
export function ShippingQuote({ items, disabled, onSelect }: Props) {
  const quote = useAction(api.shipping.quote);
  const [cep, setCep] = useState("");
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Tout changement du panier invalide la cotation affichée : il faut recalculer.
  const itemsKey = JSON.stringify(items);
  useEffect(() => {
    setResult(null);
    setSelectedId(null);
    setError(null);
    onSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setSelectedId(null);
    onSelect(null);
    if (cep.replace(/\D/g, "").length !== 8) return setError("Informe um CEP válido com 8 dígitos.");
    setLoading(true);
    try {
      setResult(await quote({ cep, items, sessionRef: getSessionRef() }));
    } catch (e) {
      setError(errorMessage(e, "Não foi possível calcular o frete. Tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  function choose(option: QuoteResult["options"][number]) {
    setSelectedId(option.quoteId);
    onSelect({ quoteId: option.quoteId, service: option.service, priceCents: option.customerPriceCents });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor="cep" className="text-sm font-medium">CEP de entrega</label>
        <div className="flex gap-2">
          <input
            id="cep"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={cep}
            onChange={(event) => setCep(formatCEP(event.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={disabled || loading}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Calculando…" : "Calcular frete"}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

      {result && result.options.length === 0 && (
        <p className="text-sm text-red-700" role="alert">{result.message}</p>
      )}

      {result && result.options.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="sr-only">Opções de frete</legend>
          {result.mock && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              Valores de teste (simulação). Não são tarifas reais.
            </p>
          )}
          {result.options.map((option) => (
            <label
              key={option.quoteId}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm ${selectedId === option.quoteId ? "border-indigo-600 bg-indigo-50" : "border-slate-300"}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="frete"
                  checked={selectedId === option.quoteId}
                  onChange={() => choose(option)}
                />
                <span>
                  <span className="block font-medium">Correios {option.service}</span>
                  {option.deliveryDays !== null && (
                    <span className="block text-xs text-slate-500">
                      Prazo estimado: {option.deliveryDays} {option.deliveryDays === 1 ? "dia" : "dias"}
                    </span>
                  )}
                </span>
              </span>
              <span className="font-semibold">{formatBRL(option.customerPriceCents)}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
