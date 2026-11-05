import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ImageUploader } from "../../components/admin/ImageUploader";
import type { AdminImage } from "../../components/admin/ImageUploader";
import { Badge, Button, Checkbox, Field, Notice, PageHeader, inputClass } from "../../components/admin/ui";
import { errorMessage } from "../../lib/errors";
import { TECHNOLOGY_LABELS } from "../../lib/labels";
import { centsToInput, parseBRL } from "../../../shared/money";
import type { Technology } from "../../../shared/pricing";
import { slugify } from "../../../shared/slug";

type ProductData = NonNullable<FunctionReturnType<typeof api.adminCatalog.getProduct>>;
type VariantData = ProductData["variants"][number];
const TECHNOLOGIES = Object.keys(TECHNOLOGY_LABELS) as Technology[];

function toInt(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/* --------------------------------- Variantes -------------------------------- */

interface VariantForm {
  id?: Id<"productVariants">;
  name: string;
  sku: string;
  format: string;
  thickness: string;
  finish: string;
  technology: Technology | "";
  adjustment: string;
  stock: string;
  threshold: string;
  active: boolean;
}

const blankVariant = (): VariantForm => ({
  name: "", sku: "", format: "", thickness: "", finish: "", technology: "",
  adjustment: "0,00", stock: "0", threshold: "", active: true,
});

function fromVariant(variant: VariantData): VariantForm {
  return {
    id: variant._id,
    name: variant.name,
    sku: variant.sku ?? "",
    format: variant.options.format ?? "",
    thickness: variant.options.thickness ?? "",
    finish: variant.options.finish ?? "",
    technology: variant.options.technology ?? "",
    adjustment: centsToInput(variant.priceAdjustmentCents),
    stock: String(variant.stockQuantity),
    threshold: variant.lowStockThreshold === undefined ? "" : String(variant.lowStockThreshold),
    active: variant.active,
  };
}

function VariantEditor({ productId, initial, onDone }: { productId: Id<"products">; initial: VariantForm; onDone: () => void }) {
  const save = useMutation(api.adminCatalog.saveVariant);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof VariantForm>(key: K, value: VariantForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const adjustment = parseBRL(form.adjustment);
    const stock = toInt(form.stock);
    const threshold = form.threshold.trim() === "" ? undefined : toInt(form.threshold);
    if (adjustment === null) return setError("Ajuste de preço inválido. Exemplo: 15,00");
    if (stock === null) return setError("Estoque: informe um número inteiro.");
    if (threshold === null) return setError("Alerta de estoque: informe um número inteiro.");
    setSaving(true);
    try {
      await save({
        id: form.id,
        productId,
        name: form.name,
        sku: form.sku || undefined,
        format: form.format || undefined,
        thickness: form.thickness || undefined,
        finish: form.finish || undefined,
        technology: form.technology || undefined,
        priceAdjustmentCents: adjustment,
        stockQuantity: stock,
        lowStockThreshold: threshold,
        active: form.active,
      });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da opção" htmlFor="var-nome" hint="Exemplo: 10 × 15 cm · QR Code">
          <input id="var-nome" className={inputClass} value={form.name} onChange={(event) => set("name", event.target.value)} required />
        </Field>
        <Field label="SKU (opcional)" htmlFor="var-sku">
          <input id="var-sku" className={inputClass} value={form.sku} onChange={(event) => set("sku", event.target.value)} />
        </Field>
        <Field label="Formato" htmlFor="var-formato">
          <input id="var-formato" className={inputClass} value={form.format} onChange={(event) => set("format", event.target.value)} />
        </Field>
        <Field label="Espessura" htmlFor="var-espessura">
          <input id="var-espessura" className={inputClass} value={form.thickness} onChange={(event) => set("thickness", event.target.value)} />
        </Field>
        <Field label="Acabamento" htmlFor="var-acabamento">
          <input id="var-acabamento" className={inputClass} value={form.finish} onChange={(event) => set("finish", event.target.value)} />
        </Field>
        <Field label="Tecnologia" htmlFor="var-tec">
          <select id="var-tec" className={inputClass} value={form.technology} onChange={(event) => set("technology", event.target.value as Technology | "")}>
            <option value="">Não definida</option>
            {TECHNOLOGIES.map((tech) => <option key={tech} value={tech}>{TECHNOLOGY_LABELS[tech]}</option>)}
          </select>
        </Field>
        <Field label="Ajuste de preço (R$)" htmlFor="var-ajuste" hint="Somado ao preço base. Pode ser negativo.">
          <input id="var-ajuste" className={inputClass} inputMode="decimal" value={form.adjustment} onChange={(event) => set("adjustment", event.target.value)} />
        </Field>
        <Field label="Estoque" htmlFor="var-estoque">
          <input id="var-estoque" className={inputClass} inputMode="numeric" value={form.stock} onChange={(event) => set("stock", event.target.value)} />
        </Field>
        <Field label="Alerta de estoque baixo" htmlFor="var-alerta" hint="Vazio = padrão (5 unidades).">
          <input id="var-alerta" className={inputClass} inputMode="numeric" value={form.threshold} onChange={(event) => set("threshold", event.target.value)} />
        </Field>
        <div className="flex items-end">
          <Checkbox id="var-ativa" checked={form.active} onChange={(value) => set("active", value)}>Disponível na loja</Checkbox>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar opção"}</Button>
        <Button variant="secondary" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

function VariantsSection({ productId, variants }: { productId: Id<"products">; variants: VariantData[] }) {
  const [editing, setEditing] = useState<VariantForm | null>(null);
  return (
    <section className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Opções (variantes)</h2>
        {!editing && <Button onClick={() => setEditing(blankVariant())}>Nova opção</Button>}
      </div>
      {editing && <VariantEditor key={editing.id ?? "nova"} productId={productId} initial={editing} onDone={() => setEditing(null)} />}
      {variants.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhuma opção. Sem opções, o produto é vendido pelo preço base.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {variants.map((variant) => (
            <li key={variant._id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{variant.name}</p>
                <p className="text-xs text-slate-500">
                  Ajuste R$ {centsToInput(variant.priceAdjustmentCents)} · estoque {variant.stockQuantity}
                  {variant.options.technology ? ` · ${TECHNOLOGY_LABELS[variant.options.technology]}` : ""}
                </p>
              </div>
              <Badge tone={variant.active ? "green" : "gray"}>{variant.active ? "Disponível" : "Oculta"}</Badge>
              <Button variant="secondary" onClick={() => setEditing(fromVariant(variant))}>Editar</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------- Produit --------------------------------- */

function ProductForm({ initial }: { initial?: ProductData }) {
  const navigate = useNavigate();
  const save = useMutation(api.adminCatalog.saveProduct);
  const categories = useQuery(api.adminCatalog.listCategories);
  const product = initial?.product;

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? centsToInput(product.basePriceCents) : "");
  const [weight, setWeight] = useState(String(product?.weightGrams ?? ""));
  const [length, setLength] = useState(String(product?.packageLengthCm ?? ""));
  const [width, setWidth] = useState(String(product?.packageWidthCm ?? ""));
  const [height, setHeight] = useState(String(product?.packageHeightCm ?? ""));
  const [categoryIds, setCategoryIds] = useState<string[]>(product?.categoryIds ?? []);
  const [technologies, setTechnologies] = useState<Technology[]>(product?.availableTechnologies ?? ["qr", "qr_nfc"]);
  const [active, setActive] = useState(product?.active ?? false);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [stockManaged, setStockManaged] = useState(product?.stockManaged ?? true);
  const [images, setImages] = useState<AdminImage[]>(product?.images.map((image) => ({ id: image.id, url: image.url })) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggle<T>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const priceCents = parseBRL(price);
    const weightGrams = toInt(weight);
    const lengthCm = toInt(length);
    const widthCm = toInt(width);
    const heightCm = toInt(height);
    if (priceCents === null || priceCents < 0) return setError("Preço inválido. Exemplo: 49,90");
    if (weightGrams === null || lengthCm === null || widthCm === null || heightCm === null) {
      return setError("Peso e dimensões da embalagem: informe números inteiros (gramas e centímetros).");
    }
    setSaving(true);
    try {
      const id = await save({
        id: product?._id,
        name,
        slug,
        shortDescription: shortDescription || undefined,
        description: description || undefined,
        categoryIds: categoryIds as Id<"categories">[],
        imageStorageIds: images.map((image) => image.id as Id<"_storage">),
        basePriceCents: priceCents,
        active,
        featured,
        weightGrams,
        packageLengthCm: lengthCm,
        packageWidthCm: widthCm,
        packageHeightCm: heightCm,
        stockManaged,
        availableTechnologies: technologies,
      });
      if (!product) navigate(`/admin/produtos/${id}`, { replace: true });
      else setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title={product ? "Editar produto" : "Novo produto"} action={<Link to="/admin/produtos" className="text-sm text-indigo-700 underline">Voltar à lista</Link>} />

      <form onSubmit={onSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="p-nome">
            <input
              id="p-nome"
              className={inputClass}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
              required
            />
          </Field>
          <Field label="Slug (endereço)" htmlFor="p-slug" hint="Letras minúsculas, números e hífens.">
            <input id="p-slug" className={inputClass} value={slug} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); }} required />
          </Field>
        </div>

        <Field label="Descrição curta" htmlFor="p-curta">
          <input id="p-curta" className={inputClass} value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} />
        </Field>
        <Field label="Descrição" htmlFor="p-desc">
          <textarea id="p-desc" className={inputClass} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>

        <Field label="Preço base (R$)" htmlFor="p-preco" hint="As opções e os designs podem acrescentar valores a este preço.">
          <input id="p-preco" className={`${inputClass} sm:w-48`} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Embalagem para o frete</legend>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Peso (g)" htmlFor="p-peso"><input id="p-peso" className={inputClass} inputMode="numeric" value={weight} onChange={(event) => setWeight(event.target.value)} required /></Field>
            <Field label="Comprimento (cm)" htmlFor="p-comp"><input id="p-comp" className={inputClass} inputMode="numeric" value={length} onChange={(event) => setLength(event.target.value)} required /></Field>
            <Field label="Largura (cm)" htmlFor="p-larg"><input id="p-larg" className={inputClass} inputMode="numeric" value={width} onChange={(event) => setWidth(event.target.value)} required /></Field>
            <Field label="Altura (cm)" htmlFor="p-alt"><input id="p-alt" className={inputClass} inputMode="numeric" value={height} onChange={(event) => setHeight(event.target.value)} required /></Field>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Categorias</legend>
          {categories === undefined ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-slate-500">Cadastre categorias primeiro (menu Categorias).</p>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {categories.map((category) => (
                <Checkbox key={category._id} id={`cat-${category._id}`} checked={categoryIds.includes(category._id)} onChange={() => setCategoryIds(toggle(categoryIds, category._id))}>
                  {category.name}
                </Checkbox>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Tecnologias oferecidas</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {TECHNOLOGIES.map((tech) => (
              <Checkbox key={tech} id={`tec-${tech}`} checked={technologies.includes(tech)} onChange={() => setTechnologies(toggle(technologies, tech))}>
                {TECHNOLOGY_LABELS[tech]}
              </Checkbox>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <p className="text-sm font-medium">Imagens</p>
          <ImageUploader images={images} onChange={setImages} max={10} />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox id="p-ativo" checked={active} onChange={setActive}>Publicado na loja</Checkbox>
          <Checkbox id="p-destaque" checked={featured} onChange={setFeatured}>Produto em destaque</Checkbox>
          <Checkbox id="p-estoque" checked={stockManaged} onChange={setStockManaged}>Controlar estoque</Checkbox>
        </div>

        {error && <Notice kind="error">{error}</Notice>}
        {saved && <Notice kind="success">Produto salvo.</Notice>}
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar produto"}</Button>
      </form>

      {product ? (
        <VariantsSection productId={product._id} variants={initial.variants} />
      ) : (
        <p className="mt-6 text-sm text-slate-500">Salve o produto para cadastrar as opções (formatos, tecnologia, estoque).</p>
      )}
    </div>
  );
}

export default function ProductEdit() {
  const { id } = useParams();
  const isNew = !id || id === "novo";
  const data = useQuery(api.adminCatalog.getProduct, isNew ? "skip" : { id });

  if (!isNew && data === undefined) return <p className="text-slate-500" role="status">Carregando…</p>;
  if (!isNew && data === null) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Produto não encontrado</h1>
        <Link to="/admin/produtos" className="text-indigo-700 underline">Voltar à lista</Link>
      </section>
    );
  }
  return <ProductForm key={id ?? "novo"} initial={data ?? undefined} />;
}
