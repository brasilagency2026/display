import { useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProductCard } from "../components/ProductCard";
import { useTitle } from "../hooks/useTitle";

const PAGE_SIZE = 12;
type Sort = "novidades" | "menor_preco" | "maior_preco";

function parseSort(value: string | null): Sort {
  return value === "menor_preco" || value === "maior_preco" ? value : "novidades";
}

export default function Shop() {
  useTitle("Loja");
  const [params, setParams] = useSearchParams();
  const categorySlug = params.get("categoria") ?? undefined;
  const search = params.get("q") ?? undefined;
  const sort = parseSort(params.get("ordem"));
  const [searchText, setSearchText] = useState(search ?? "");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const categories = useQuery(api.catalog.listCategories);
  const products = useQuery(api.catalog.listProducts, { categorySlug, search, sort });

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setVisible(PAGE_SIZE);
    setParams(next, { replace: true });
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    update({ q: searchText.trim() || undefined });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Loja</h1>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <form onSubmit={onSearch} className="flex gap-2" role="search">
          <label htmlFor="busca" className="sr-only">Buscar por nome</label>
          <input
            id="busca"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar por nome"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-72"
          />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Buscar
          </button>
        </form>

        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="ordem" className="text-slate-500">Ordenar por</label>
          <select
            id="ordem"
            value={sort}
            onChange={(event) => update({ ordem: event.target.value === "novidades" ? undefined : event.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="novidades">Novidades</option>
            <option value="menor_preco">Menor preço</option>
            <option value="maior_preco">Maior preço</option>
          </select>
        </div>
      </div>

      {categories && categories.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Categorias">
          <li>
            <button
              type="button"
              onClick={() => update({ categoria: undefined })}
              aria-pressed={!categorySlug}
              className={`rounded-full border px-4 py-1.5 text-sm ${!categorySlug ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300"}`}
            >
              Todas
            </button>
          </li>
          {categories.map((category) => (
            <li key={category._id}>
              <button
                type="button"
                onClick={() => update({ categoria: category.slug })}
                aria-pressed={categorySlug === category.slug}
                className={`rounded-full border px-4 py-1.5 text-sm ${categorySlug === category.slug ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300"}`}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {products === undefined ? (
        <p className="text-slate-500" role="status">Carregando produtos…</p>
      ) : products.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-6 text-slate-600">
          Nenhum produto encontrado{search || categorySlug ? " com esses filtros" : " no momento"}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.slice(0, visible).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
          {visible < products.length && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setVisible((value) => value + PAGE_SIZE)}
                className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium hover:border-indigo-600"
              >
                Mostrar mais
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
