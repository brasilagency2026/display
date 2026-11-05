import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useTitle } from "../../hooks/useTitle";

const NAV = [
  ["/admin", "Painel", true],
  ["/admin/produtos", "Produtos", false],
  ["/admin/categorias", "Categorias", false],
  ["/admin/designs", "Designs", false],
  ["/admin/estoque", "Estoque", false],
  ["/admin/configuracoes", "Configurações", false],
] as const;

/**
 * Garde d'interface uniquement : la vraie sécurité est dans chaque fonction Convex (requireAdmin).
 */
export default function AdminLayout() {
  useTitle("Administração");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");

  if (isLoading || (isAuthenticated && viewer === undefined)) {
    return <p className="p-6 text-slate-500" role="status">Carregando…</p>;
  }
  if (!isAuthenticated) return <Navigate to="/entrar" replace />;
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "super_admin")) {
    return (
      <section className="mx-auto max-w-md space-y-3 p-6">
        <h1 className="text-2xl font-semibold">Acesso restrito</h1>
        <p className="text-slate-600">Esta área é exclusiva da administração da loja.</p>
        <Link to="/" className="text-indigo-700 underline">Voltar à loja</Link>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="font-semibold">Painel administrativo</p>
          <Link to="/" className="text-sm text-indigo-700 underline">Ver loja</Link>
        </div>
        <nav aria-label="Administração" className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-1 text-sm">
            {NAV.map(([to, label, end]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `inline-block border-b-2 px-3 py-2 ${isActive ? "border-indigo-600 font-medium text-indigo-700" : "border-transparent hover:text-indigo-700"}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
