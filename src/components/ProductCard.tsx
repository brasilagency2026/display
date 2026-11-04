import { Link } from "react-router-dom";
import { formatBRL } from "../lib/format";
import { ImageBox } from "./ImageBox";

export interface ProductCardData {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  fromPriceCents: number;
  imageUrl: string | null;
  isDemo: boolean;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      to={`/produto/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <ImageBox src={product.imageUrl} alt={product.name} className="aspect-square w-full" />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-medium group-hover:text-indigo-700">{product.name}</h3>
        {product.shortDescription && (
          <p className="line-clamp-2 text-sm text-slate-500">{product.shortDescription}</p>
        )}
        <p className="mt-auto pt-2 text-sm text-slate-500">
          a partir de <span className="text-base font-semibold text-slate-900">{formatBRL(product.fromPriceCents)}</span>
        </p>
      </div>
    </Link>
  );
}
