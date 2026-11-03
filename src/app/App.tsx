import { Link, Route, Routes } from "react-router-dom";
import { STORE_NAME } from "../lib/config";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold">
            {STORE_NAME}
          </Link>
          <ul className="flex items-center gap-5 text-sm">
            <li><Link to="/">Início</Link></li>
            <li><Link to="/loja">Loja</Link></li>
            <li><Link to="/como-funciona">Como funciona</Link></li>
            <li><Link to="/carrinho">Carrinho</Link></li>
            <li><Link to="/entrar">Entrar</Link></li>
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} {STORE_NAME}
      </footer>
    </div>
  );
}

function Home({ backendConnected }: { backendConnected: boolean }) {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold sm:text-4xl">
        Displays acrílicos com QR Code e NFC
      </h1>
      <p className="max-w-2xl text-slate-600">
        Modelos prontos para restaurantes, lojas e empresas. Escolha um design,
        receba em casa e conecte seus clientes ao seu cardápio, WhatsApp ou site.
      </p>
      <Link
        to="/loja"
        className="inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white"
      >
        Ver modelos
      </Link>
      {!backendConnected && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Modo de desenvolvimento: backend Convex não configurado (VITE_CONVEX_URL ausente).
        </p>
      )}
    </section>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-500">Em construção.</p>
    </section>
  );
}

export default function App({ backendConnected }: { backendConnected: boolean }) {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home backendConnected={backendConnected} />} />
        <Route path="/loja" element={<Placeholder title="Loja" />} />
        <Route path="/como-funciona" element={<Placeholder title="Como funciona" />} />
        <Route path="/carrinho" element={<Placeholder title="Carrinho" />} />
        <Route path="/entrar" element={<Placeholder title="Entrar" />} />
        <Route path="/d/:code" element={<Placeholder title="Redirecionando…" />} />
        <Route path="*" element={<Placeholder title="Página não encontrada" />} />
      </Routes>
    </Layout>
  );
}
