import { Navigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { useTitle } from "../hooks/useTitle";

export default function Account() {
  useTitle("Minha conta");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer);

  if (isLoading) return <p className="text-slate-500" role="status">Carregando…</p>;
  if (!isAuthenticated) return <Navigate to="/entrar" replace />;

  return (
    <section className="max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">Minha conta</h1>
      <div className="rounded-xl border border-slate-200 p-5">
        <p className="text-sm text-slate-500">E-mail</p>
        <p className="font-medium">{viewer?.email ?? "…"}</p>
      </div>
      <div className="rounded-xl bg-slate-50 p-5">
        <h2 className="font-medium">Meus pedidos</h2>
        <p className="mt-1 text-sm text-slate-500">Seus pedidos aparecerão aqui quando a finalização estiver disponível.</p>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:border-red-600 hover:text-red-700"
      >
        Sair
      </button>
    </section>
  );
}
