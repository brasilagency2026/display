import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ImageUploader } from "../../components/admin/ImageUploader";
import type { AdminImage } from "../../components/admin/ImageUploader";
import { Badge, Button, Checkbox, Field, Notice, PageHeader, inputClass } from "../../components/admin/ui";
import { errorMessage } from "../../lib/errors";
import { slugify } from "../../../shared/slug";

interface CategoryForm {
  id?: Id<"categories">;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  active: boolean;
  images: AdminImage[];
}

const blank = (): CategoryForm => ({ name: "", slug: "", description: "", sortOrder: "0", active: true, images: [] });

function CategoryEditor({ initial, onDone }: { initial: CategoryForm; onDone: () => void }) {
  const save = useMutation(api.adminCatalog.saveCategory);
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^\d+$/.test(form.sortOrder)) return setError("Ordem: informe um número inteiro.");
    setSaving(true);
    try {
      await save({
        id: form.id,
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        sortOrder: Number(form.sortOrder),
        active: form.active,
        imageStorageId: (form.images[0]?.id as Id<"_storage"> | undefined) ?? null,
      });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-8 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{form.id ? "Editar categoria" : "Nova categoria"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="cat-nome">
          <input
            id="cat-nome"
            className={inputClass}
            value={form.name}
            onChange={(event) => {
              set("name", event.target.value);
              if (!slugTouched) set("slug", slugify(event.target.value));
            }}
            required
          />
        </Field>
        <Field label="Slug (endereço)" htmlFor="cat-slug" hint="Letras minúsculas, números e hífens.">
          <input
            id="cat-slug"
            className={inputClass}
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true);
              set("slug", event.target.value);
            }}
            required
          />
        </Field>
      </div>
      <Field label="Descrição" htmlFor="cat-desc">
        <textarea id="cat-desc" className={inputClass} rows={2} value={form.description} onChange={(event) => set("description", event.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ordem de exibição" htmlFor="cat-ordem">
          <input id="cat-ordem" className={inputClass} inputMode="numeric" value={form.sortOrder} onChange={(event) => set("sortOrder", event.target.value)} />
        </Field>
        <div className="flex items-end">
          <Checkbox id="cat-ativa" checked={form.active} onChange={(value) => set("active", value)}>Publicada na loja</Checkbox>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Imagem</p>
        <ImageUploader images={form.images} onChange={(images) => set("images", images.slice(-1))} max={1} />
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        <Button variant="secondary" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

export default function Categories() {
  const categories = useQuery(api.adminCatalog.listCategories);
  const setActive = useMutation(api.adminCatalog.setCategoryActive);
  const [editing, setEditing] = useState<CategoryForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: Id<"categories">, active: boolean) {
    setError(null);
    try {
      await setActive({ id, active });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div>
      <PageHeader title="Categorias" action={!editing && <Button onClick={() => setEditing(blank())}>Nova categoria</Button>} />
      {editing && <CategoryEditor key={editing.id ?? "nova"} initial={editing} onDone={() => setEditing(null)} />}
      {error && <Notice kind="error">{error}</Notice>}

      {categories === undefined ? (
        <p className="text-slate-500" role="status">Carregando…</p>
      ) : categories.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-slate-600">Nenhuma categoria cadastrada.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {categories.map((category) => (
            <li key={category._id} className="flex flex-wrap items-center gap-3 p-4">
              {category.image ? (
                <img src={category.image.url} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <div className="h-12 w-12 rounded bg-slate-100" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {category.name} {category.isDemo && <Badge tone="amber">DEMO</Badge>}
                </p>
                <p className="text-xs text-slate-500">/{category.slug} · ordem {category.sortOrder}</p>
              </div>
              <Badge tone={category.active ? "green" : "gray"}>{category.active ? "Publicada" : "Oculta"}</Badge>
              <Button
                variant="secondary"
                onClick={() =>
                  setEditing({
                    id: category._id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description ?? "",
                    sortOrder: String(category.sortOrder),
                    active: category.active,
                    images: category.image ? [{ id: category.image.id, url: category.image.url }] : [],
                  })
                }
              >
                Editar
              </Button>
              <Button variant="secondary" onClick={() => void toggle(category._id, !category.active)}>
                {category.active ? "Ocultar" : "Publicar"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
