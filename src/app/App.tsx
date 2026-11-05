import { Link, Outlet, Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useTitle } from "../hooks/useTitle";
import Account from "../pages/Account";
import Cart from "../pages/Cart";
import Home from "../pages/Home";
import HowItWorks from "../pages/HowItWorks";
import Product from "../pages/Product";
import Shop from "../pages/Shop";
import SignIn from "../pages/SignIn";
import AdminLayout from "../pages/admin/AdminLayout";
import Categories from "../pages/admin/Categories";
import Dashboard from "../pages/admin/Dashboard";
import Designs from "../pages/admin/Designs";
import ProductEdit from "../pages/admin/ProductEdit";
import Products from "../pages/admin/Products";
import SettingsPage from "../pages/admin/Settings";
import Stock from "../pages/admin/Stock";

function NotFound() {
  useTitle("Página não encontrada");
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link to="/" className="text-indigo-700 underline">Voltar ao início</Link>
    </section>
  );
}

function NoBackend() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Loja em configuração</h1>
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
        Modo de desenvolvimento: backend Convex não configurado (VITE_CONVEX_URL ausente).
      </p>
    </section>
  );
}

function StoreShell({ backendConnected }: { backendConnected: boolean }) {
  return (
    <Layout backendConnected={backendConnected}>
      <Outlet />
    </Layout>
  );
}

export default function App({ backendConnected }: { backendConnected: boolean }) {
  const guard = (element: React.ReactNode) => (backendConnected ? element : <NoBackend />);
  return (
    <Routes>
      <Route path="/admin" element={guard(<AdminLayout />)}>
        <Route index element={<Dashboard />} />
        <Route path="produtos" element={<Products />} />
        <Route path="produtos/:id" element={<ProductEdit />} />
        <Route path="categorias" element={<Categories />} />
        <Route path="designs" element={<Designs />} />
        <Route path="estoque" element={<Stock />} />
        <Route path="configuracoes" element={<SettingsPage />} />
      </Route>

      <Route element={<StoreShell backendConnected={backendConnected} />}>
        <Route path="/" element={guard(<Home />)} />
        <Route path="/loja" element={guard(<Shop />)} />
        <Route path="/produto/:slug" element={guard(<Product />)} />
        <Route path="/carrinho" element={guard(<Cart />)} />
        <Route path="/entrar" element={guard(<SignIn />)} />
        <Route path="/conta" element={guard(<Account />)} />
        <Route path="/como-funciona" element={<HowItWorks />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
