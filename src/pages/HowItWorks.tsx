import { Link } from "react-router-dom";
import { useTitle } from "../hooks/useTitle";

export default function HowItWorks() {
  useTitle("Como funciona");
  return (
    <article className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Como funciona</h1>
      <p className="text-lg text-slate-600">
        Cada display tem um QR Code e, nas versões com NFC, um chip. Ambos abrem o mesmo endereço
        da web, por exemplo o seu cardápio digital, catálogo, WhatsApp, Instagram ou site.
      </p>

      <h2 className="text-xl font-semibold">QR Code</h2>
      <p className="text-slate-600">
        O cliente abre a câmera do celular e aponta para o QR Code. O endereço abre na hora, sem
        precisar instalar aplicativo.
      </p>

      <h2 className="text-xl font-semibold">NFC</h2>
      <p className="text-slate-600">
        Nas versões com NFC, basta aproximar o celular do display. A compatibilidade depende do
        aparelho do cliente.
      </p>

      <h2 className="text-xl font-semibold">Designs</h2>
      <p className="text-slate-600">
        Você escolhe entre os modelos prontos da loja. Os designs não podem ser editados nem
        personalizados.
      </p>

      <Link to="/loja" className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white">
        Ver modelos
      </Link>
    </article>
  );
}
