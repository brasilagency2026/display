import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ImageBox } from "../components/ImageBox";
import { useTitle } from "../hooks/useTitle";
import { useCart } from "../lib/cart";
import { formatBRL } from "../lib/format";
import { TECHNOLOGY_LABELS } from "../lib/labels";
import { MAX_QUANTITY, isDesignCompatible, unitPriceCents } from "../../shared/pricing";

export default function Product() {
  const { slug } = useParams();
  const data = useQuery(api.catalog.getProduct, slug ? { slug } : "skip");
  useTitle(data?.product.name);
  const cart = useCart();

  const [variantId, setVariantId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  if (data === undefined) return <p className="text-slate-500" role="status">Carregando…</p>;
  if (data === null) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Produto não encontrado</h1>
        <Link to="/loja" className="text-indigo-700 underline">Voltar para a loja</Link>
      </section>
    );
  }

  const { product, variants, designs } = data;
  const variant =
    variants.find((candidate) => candidate._id === variantId) ??
    (variants.length === 1 ? variants[0] : undefined);

  const availableDesigns = designs.filter((design) =>
    isDesignCompatible(
      { supportedTechnologies: design.supportedTechnologies, compatibleVariantIds: design.compatibleVariantIds },
      variant ? { id: variant._id, technology: variant.options.technology } : null,
    ),
  );
  const design = availableDesigns.find((candidate) => candidate._id === designId);

  const unitCents = unitPriceCents({
    basePriceCents: product.basePriceCents,
    variantAdjustmentCents: variant?.priceAdjustmentCents,
    designAdjustmentCents: design?.priceAdjustmentCents,
  });

  const gallery = [...(design?.imageUrls ?? []), ...product.imageUrls];
  const currentImage = gallery[Math.min(imageIndex, Math.max(gallery.length - 1, 0))] ?? null;

  const needsVariant = variants.length > 0 && !variant;
  const needsDesign = designs.length > 0 && !design;
  const outOfStock = variant ? !variant.inStock : false;
  const canAdd = !needsVariant && !needsDesign && !outOfStock;

  let hint: string | null = null;
  if (needsVariant) hint = "Escolha uma opção para continuar.";
  else if (needsDesign) hint = "Escolha um design para continuar.";
  else if (outOfStock) hint = "Esta opção está indisponível no momento.";

  function addToCart() {
    if (!canAdd) return;
    cart.add({
      productId: product._id,
      variantId: variant?._id,
      designId: design?._id,
      quantity,
    });
    setAdded(true);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-3">
        <ImageBox src={currentImage} alt={product.name} className="aspect-square w-full rounded-xl" />
        {gallery.length > 1 && (
          <ul className="flex gap-2 overflow-x-auto" aria-label="Imagens">
            {gallery.map((url, index) => (
              <li key={url}>
                <button
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Ver imagem ${index + 1}`}
                  className={`block h-16 w-16 overflow-hidden rounded-lg border-2 ${index === imageIndex ? "border-indigo-600" : "border-transparent"}`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          {product.shortDescription && <p className="mt-2 text-slate-600">{product.shortDescription}</p>}
        </div>

        <p className="text-3xl font-semibold" aria-live="polite">{formatBRL(unitCents)}</p>

        {variants.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="font-medium">Opções</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {variants.map((option) => {
                const selected = variant?._id === option._id;
                return (
                  <label
                    key={option._id}
                    className={`cursor-pointer rounded-lg border p-3 text-sm ${selected ? "border-indigo-600 bg-indigo-50" : "border-slate-300"} ${option.inStock ? "" : "opacity-50"}`}
                  >
                    <input
                      type="radio"
                      name="variante"
                      className="sr-only"
                      checked={selected}
                      disabled={!option.inStock}
                      onChange={() => {
                        setVariantId(option._id);
                        setAdded(false);
                      }}
                    />
                    <span className="block font-medium">{option.name}</span>
                    <span className="block text-slate-500">
                      {option.options.technology ? TECHNOLOGY_LABELS[option.options.technology] : null}
                      {!option.inStock && " · Indisponível"}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {designs.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="font-medium">Design</legend>
            {availableDesigns.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum design disponível para a opção escolhida.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {availableDesigns.map((option) => {
                  const selected = design?._id === option._id;
                  return (
                    <label
                      key={option._id}
                      className={`cursor-pointer overflow-hidden rounded-lg border text-sm ${selected ? "border-indigo-600 ring-2 ring-indigo-600" : "border-slate-300"}`}
                    >
                      <input
                        type="radio"
                        name="design"
                        className="sr-only"
                        checked={selected}
                        onChange={() => {
                          setDesignId(option._id);
                          setImageIndex(0);
                          setAdded(false);
                        }}
                      />
                      <ImageBox src={option.imageUrls[0]} alt={option.name} className="aspect-square w-full" />
                      <span className="block p-2">
                        <span className="block font-medium">{option.name}</span>
                        {option.priceAdjustmentCents > 0 && (
                          <span className="block text-slate-500">+ {formatBRL(option.priceAdjustmentCents)}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-slate-500">
              Os designs são modelos prontos e não podem ser editados.
            </p>
          </fieldset>
        )}

        <div className="flex items-center gap-3">
          <label htmlFor="quantidade" className="font-medium">Quantidade</label>
          <input
            id="quantidade"
            type="number"
            min={1}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(event) => {
              const next = Math.floor(Number(event.target.value));
              setQuantity(Number.isFinite(next) ? Math.min(Math.max(next, 1), MAX_QUANTITY) : 1);
              setAdded(false);
            }}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={addToCart}
            disabled={!canAdd}
            className="w-full rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            Adicionar ao carrinho
          </button>
          {hint && <p className="text-sm text-slate-500">{hint}</p>}
          {added && (
            <p className="text-sm text-emerald-700" role="status">
              Adicionado ao carrinho. <Link to="/carrinho" className="underline">Ver carrinho</Link>
            </p>
          )}
        </div>

        {product.description && (
          <section className="border-t border-slate-200 pt-4">
            <h2 className="font-medium">Descrição</h2>
            <p className="mt-2 whitespace-pre-line text-slate-600">{product.description}</p>
          </section>
        )}

        <p className="text-sm text-slate-500">
          O frete (Correios PAC ou SEDEX) é calculado na finalização do pedido.
        </p>
        {product.isDemo && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Produto de demonstração.</p>
        )}
      </div>
    </div>
  );
}
