import { useEffect } from "react";
import { STORE_NAME } from "../lib/config";

/** Titre de page PT-BR : « Página · Nome da loja ». */
export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${STORE_NAME}` : `${STORE_NAME} · Displays acrílicos com QR Code e NFC`;
  }, [title]);
}
