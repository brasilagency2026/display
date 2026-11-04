import { useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { STORE_NAME } from "../lib/config";
import { useCart } from "../lib/cart";

function AccountLink({ onNavigate }: { onNavigate: () => void }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return null;
  return (
    <NavLink to={isAuthenticated ? "/conta" : "/entrar"} onClick={onNavigate} className="hover:text-indigo-700">
      {isAuthenticated ? "Minha conta" : "Entrar"}
    </NavLink>
  );
}

export function Layout({ children, backendConnected }: { children: ReactNode; backendConnected: boolean }) {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const close = () => setOpen(false);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "font-medium text-indigo-700" : "hover:text-indigo-700";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Principal">
          <Link to="/" onClick={close} className="text-lg font-semibold">
            {STORE_NAME}
          </Link>

          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm md:hidden"
            aria-expanded={open}
            aria-controls="menu-principal"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Fechar" : "Menu"}
          </button>

          <ul
            id="menu-principal"
            className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-full flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 text-sm md:static md:flex md:flex-row md:items-center md:gap-6 md:border-0 md:p-0`}
          >
            <li><NavLink to="/" end onClick={close} className={linkClass}>Início</NavLink></li>
            <li><NavLink to="/loja" onClick={close} className={linkClass}>Loja</NavLink></li>
            <li><NavLink to="/como-funciona" onClick={close} className={linkClass}>Como funciona</NavLink></li>
            {backendConnected && <li><AccountLink onNavigate={close} /></li>}
            <li>
              <NavLink to="/carrinho" onClick={close} className={linkClass}>
                Carrinho
                {count > 0 && (
                  <span className="ml-1.5 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white" aria-label={`${count} itens`}>
                    {count}
                  </span>
                )}
              </NavLink>
            </li>
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50 py-8 text-sm text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {STORE_NAME}</p>
          <p>Displays acrílicos com QR Code e NFC</p>
        </div>
      </footer>
    </div>
  );
}
