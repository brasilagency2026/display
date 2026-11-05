import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ImageUploader } from "../../components/admin/ImageUploader";
import type { AdminImage } from "../../components/admin/ImageUploader";
import { Badge, Button, Checkbox, Field, Notice, PageHeader, inputClass } from "../../components/admin/ui";
import { errorMessage } from "../../lib/errors";
import { formatBRL } from "../../lib/format";
import { TECHNOLOGY_LABELS } from "../../lib/labels";
import { centsToInput, parseBRL } from "../../../shared/money";
import type { Technology } from "../../../shared/pricing";
import { slugify } from "../../../shared/slug";

const TECHNOLOGIES = Object.keys(TECHNOLOGY_LABELS) as Technology[];

interface DesignForm {
  id?: Id<"designs">;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  active: boolean;
  price: string;
  technologies: Technology[];
  productIds: string[];
  images: AdminImage[];
}

const blank = (): DesignForm => ({
  name: "", slug: "", description: "", sortOrder: "0", active: true, price: "0,00",
  technologies: ["qr", "qr_nfc"], productIds: [], images: [],
});

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

function DesignEditor({ initial, onDone }: { initial: DesignForm; onDone: () => void }) {
  const save = useMutation(api.adminCatalog.saveDesign);
  const products = useQuery(api.adminCatalog.listProducts);
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof DesignForm>(key: K, value: DesignForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const priceCents = parseBRL(form.price);
    if (priceCents === null || priceCents < 0) return setError("Suplemento inválido. Exemplo: 5,00");
    if (!/^\d+$/.test(form.sortOrder)) return setError("Ordem: informe um número inteiro.");
    setSaving(true);
    try {
      await save({
        id: form.id,
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        imageStorageIds: form.images.map((image) => image.id as Id<"_storage">),
        sortOrder: Number(form.sortOrder),
        active: form.active,
        compatibleProductIds: form.productIds as Id<"products">[],
        supportedTechnologies: form.technologies,
        priceAdjustmentCents: priceCents,
      });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-8 space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{form.id ? "Editar design" : "Novo design"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="d-nome">
          <input
            id="d-nome"
            className={inputClass}
            value={form.name}
            onChange={(event) => {
              set("name", event.target.value);
              if (!slugTouched) set("slug", slugify(event.target.value));
            }}
            required
          />
        </Field>
        <Field label="Slug (endereço)" htmlFor="d-slug">
          <input id="d-slug" className={inputClass} value={form.slug} onChange={(event) => { setSlugTouched(true); set("slug", event.target.value); }} required />
        </Field>
        <Field label="Suplemento de preço (R$)" htmlFor="d-preco" hint="Somado ao preço do produto quando este design é escolhido.">
          <input id="d-preco" className={inputClass} inputMode="decimal" value={form.price} onChange={(event) => set("price", event.target.value)} />
        </Field>
        <Field label="Ordem de exibição" htmlFor="d-ordem">
          <input id="d-ordem" className={inputClass} inputMode="numeric" value={form.sortOrder} onChange={(event) => set("sortOrder", event.target.value)} />
        </Field>
      </div>
      <Field label="Descrição" htmlFor="d-desc">
        <textarea id="d-desc" className={inputClass} rows={2} value={form.description} onChange={(event) => set("description", event.target.value)} />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tecnologias compatíveis</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {TECHNOLOGIES.map((tech) => (
            <Checkbox key={tech} id={`d-tec-${tech}`} checked={form.technologies.includes(tech)} onChange={() => set("technologies", toggle(form.technologies, tech))}>
              {TECHNOLOGY_LABELS[tech]}
            </Checkbox>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Produtos compatíveis</legend>
        {products === undefined ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-slate-500">Cadastre produtos primeiro.</p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {products.filter((product) => !product.archived).map((product) => (
              <Checkbox key={product._id} id={`d-prod-${product._id}`} checked={form.productIds.includes(product._id)} onChange={() => set("productIds", toggle(form.productIds, product._id))}>
                {product.name}
              </Checkbox>
            ))}
          </div>
        )}
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-medium">Imagens do design</p>
        <ImageUploader images={form.images} onChange={(images) => set("images", images)} max={10} />
      </div>

      <Checkbox id="d-ativo" checked={form.active} onChange={(value) => set("active", value)}>Publicado na loja</Checkbox>

      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar design"}</Button>
        <Button variant="secondary" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

export default function Designs() {
  const designs = useQuery(api.adminCatalog.listDesigns);
  const setState = useMutation(api.adminCatalog.setDesignState);
  const [editing, setEditing] = useState<DesignForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(id: Id<"designs">, state: { active?: boolean; archived?: boolean }) {
    setError(null);
    try {
      await setState({ id, ...state });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div>
      <PageHeader title="Designs" action={!editing && <Button onClick={() => setEditing(blank())}>Novo design</Button>} />
      <p className="mb-4 text-sm text-slate-600">
        Os designs são modelos prontos criados por você. Os clientes apenas escolhem entre os designs publicados.
      </p>
      {editing && <DesignEditor key={editing.id ?? "novo"} initial={editing} onDone={() => setEditing(null)} />}
      {error && <Notice kind="error">{error}</Notice>}

      {designs === undefined ? (
        <p className="text-slate-500" role="status">Carregando…</p>
      ) : designs.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-slate-600">Nenhum design cadastrado.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {designs.map((design) => (
            <li key={design._id} className="flex flex-wrap items-center gap-3 p-4">
              {design.images[0] ? (
                <img src={design.images[0].url} alt="" className="h-14 w-14 rounded object-cover" />
              ) : (
                <div className="h-14 w-14 rounded bg-slate-100" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{design.name} {design.isDemo && <Badge tone="amber">DEMO</Badge>}</p>
                <p className="text-xs text-slate-500">
                  {design.priceAdjustmentCents > 0 ? `+ ${formatBRL(design.priceAdjustmentCents)} · ` : ""}
                  {design.compatibleProductIds.length} produtos · {design.supportedTechnologies.map((tech) => TECHNOLOGY_LABELS[tech]).join(", ")}
                </p>
              </div>
              {design.archived ? (
                <Badge tone="gray">Arquivado</Badge>
              ) : (
                <Badge tone={design.active ? "green" : "gray"}>{design.active ? "Publicado" : "Oculto"}</Badge>
              )}
              <Button
                variant="secondary"
                onClick={() =>
                  setEditing({
                    id: design._id,
                    name: design.name,
                    slug: design.slug,
                    description: design.description ?? "",
                    sortOrder: String(design.sortOrder),
                    active: design.active,
                    price: centsToInput(design.priceAdjustmentCents),
                    technologies: design.supportedTechnologies,
                    productIds: design.compatibleProductIds,
                    images: design.images.map((image) => ({ id: image.id, url: image.url })),
                  })
                }
              >
                Editar
              </Button>
              {!design.archived && (
                <Button variant="secondary" onClick={() => void update(design._id, { active: !design.active })}>
                  {design.active ? "Ocultar" : "Publicar"}
                </Button>
              )}
              <Button variant="secondary" onClick={() => void update(design._id, { archived: !design.archived })}>
                {design.archived ? "Restaurar" : "Arquivar"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
