import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProductCard } from "../components/ProductCard";
import { useTitle } from "../hooks/useTitle";

const BENEFITS = [
  ["Fácil de usar", "O cliente aponta o celular e acessa o seu conteúdo."],
  ["Acesso rápido por QR Code", "Cardápio, WhatsApp, Instagram ou site em um toque."],
  ["Tecnologia NFC", "Opção com chip NFC, além do QR Code."],
  ["Design profissional", "Modelos prontos, criados pela nossa equipe."],
  ["Ideal para estabelecimentos", "Para mesas, balcões e vitrines."],
] as const;

const STEPS = [
  ["Escolha o modelo", "Veja os displays e selecione um dos designs disponíveis."],
  ["Faça o pedido", "Informe o endereço e escolha o frete e a forma de pagamento."],
  ["Produzimos e enviamos", "Seu display é preparado com QR Code e, se escolhido, chip NFC."],
  ["Use no seu negócio", "Coloque o display no balcão ou na mesa e pronto."],
] as const;

const FAQ = [
  ["Posso personalizar o design?", "Não. Você escolhe entre os modelos prontos publicados na loja."],
  ["O que o QR Code abre?", "Qualquer endereço da web, como cardápio digital, catálogo, WhatsApp, Instagram ou seu site."],
  ["Como funciona o NFC?", "Nas versões com NFC, basta aproximar o celular do display para abrir o mesmo conteúdo."],
] as const;

export default function Home() {
  useTitle();
  const featured = useQuery(api.catalog.featuredProducts);
  const categories = useQuery(api.catalog.listCategories);

  return (
    <div className="space-y-16">
      <section className="space-y-5 py-6 sm:py-12">
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
          Displays acrílicos com QR Code e NFC
        </h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Modelos prontos para restaurantes, lojas e empresas. Escolha um design e conecte
          seus clientes ao seu cardápio, WhatsApp ou site.
        </p>
        <Link
          to="/loja"
          className="inline-block rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
        >
          Ver modelos
        </Link>
      </section>

      <section aria-labelledby="vantagens">
        <h2 id="vantagens" className="sr-only">Vantagens</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {BENEFITS.map(([title, text]) => (
            <li key={title} className="rounded-xl border border-slate-200 p-4">
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {featured && featured.length > 0 && (
        <section aria-labelledby="destaques" className="space-y-5">
          <h2 id="destaques" className="text-2xl font-semibold">Destaques</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}

      {categories && categories.length > 0 && (
        <section aria-labelledby="categorias" className="space-y-5">
          <h2 id="categorias" className="text-2xl font-semibold">Categorias</h2>
          <ul className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <li key={category._id}>
                <Link
                  to={`/loja?categoria=${category.slug}`}
                  className="inline-block rounded-full border border-slate-300 px-4 py-2 text-sm hover:border-indigo-600 hover:text-indigo-700"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="como-funciona" className="space-y-5">
        <h2 id="como-funciona" className="text-2xl font-semibold">Como funciona</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, text], index) => (
            <li key={title} className="rounded-xl bg-slate-50 p-5">
              <span className="text-sm font-semibold text-indigo-700">Passo {index + 1}</span>
              <p className="mt-1 font-medium">{title}</p>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq" className="space-y-4">
        <h2 id="faq" className="text-2xl font-semibold">Perguntas frequentes</h2>
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="group p-4">
              <summary className="cursor-pointer font-medium">{question}</summary>
              <p className="mt-2 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
