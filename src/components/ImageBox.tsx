interface ImageBoxProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

/** Image produit/design, ou espace réservé neutre tant qu'aucune image n'a été envoyée. */
export function ImageBox({ src, alt, className = "" }: ImageBoxProps) {
  if (src) {
    return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
  }
  return (
    <div
      role="img"
      aria-label={`${alt} (sem imagem)`}
      className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-1/3 w-1/3" fill="currentColor" aria-hidden="true">
        <path d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h2v2h-2v-2Zm2 2h2v2h-2v-2Zm2-2h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z" />
      </svg>
    </div>
  );
}
