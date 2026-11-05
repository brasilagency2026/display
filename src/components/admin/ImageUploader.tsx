import { useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export interface AdminImage {
  id: string;
  url: string;
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  images: AdminImage[];
  onChange: (images: AdminImage[]) => void;
  max: number;
}

/** Envoi d'images vers Convex File Storage. Le serveur revalide type et taille à l'enregistrement. */
export function ImageUploader({ images, onChange, max }: Props) {
  const generateUploadUrl = useMutation(api.admin.generateUploadUrl);
  const registerUploadedImage = useMutation(api.admin.registerUploadedImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setError(null);

    if (images.length + files.length > max) {
      setError(`No máximo ${max} imagens.`);
      return;
    }
    for (const file of files) {
      if (!ALLOWED.includes(file.type)) return setError("Use imagens JPG, PNG ou WebP.");
      if (file.size > MAX_BYTES) return setError("Cada imagem deve ter no máximo 5 MB.");
    }

    setBusy(true);
    try {
      const added: AdminImage[] = [];
      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error("upload");
        const { storageId } = (await response.json()) as { storageId: string };
        const result = await registerUploadedImage({ storageId: storageId as Id<"_storage"> });
        if (!result.ok) {
          setError(result.error);
          break;
        }
        added.push({ id: storageId, url: result.url });
      }
      if (added.length > 0) onChange([...images, ...added]);
    } catch {
      setError("Falha ao enviar a imagem. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="space-y-1 rounded-lg border border-slate-200 p-2">
              <img src={image.url} alt="" className="aspect-square w-full rounded object-cover" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{index === 0 ? "Principal" : `#${index + 1}`}</span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Mover para a esquerda" className="px-1 disabled:opacity-30">←</button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === images.length - 1} aria-label="Mover para a direita" className="px-1 disabled:opacity-30">→</button>
                  <button type="button" onClick={() => onChange(images.filter((item) => item.id !== image.id))} className="px-1 text-red-700">Remover</button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div>
        <label className={`inline-block cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:border-indigo-600 ${busy || images.length >= max ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? "Enviando…" : "Adicionar imagens"}
          <input type="file" accept={ALLOWED.join(",")} multiple className="sr-only" onChange={onFiles} disabled={busy || images.length >= max} />
        </label>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG ou WebP, até 5 MB cada. A primeira é a imagem principal.</p>
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
