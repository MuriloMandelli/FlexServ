import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from "react-router-dom";
import { AuthProvider, RotaProtegida } from "./auth";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import Clientes from "./pages/Clientes";
import ClienteForm from "./pages/ClienteForm";
import Lojas from "./pages/Lojas";
import LojaForm from "./pages/LojaForm";
import Vendedores from "./pages/Vendedores";
import VendedorForm from "./pages/VendedorForm";
import Itens from "./pages/Itens";
import ItemForm from "./pages/ItemForm";
import NovaOS from "./pages/NovaOS";
import ConsultaOS from "./pages/ConsultaOS";
import DetalheOS from "./pages/DetalheOS";
import GerenciarStatus from "./pages/GerenciarStatus";
import Vendas from "./pages/Vendas";
import NovaVenda from "./pages/NovaVenda";
import DetalheVenda from "./pages/DetalheVenda";
import Relatorios from "./pages/Relatorios";
import Mais from "./pages/Mais";
import AprovarOS from "./pages/AprovarOS";
import TermosAprovacao from "./pages/TermosAprovacao";

// Roteador "de dados" do react-router: permite avisar quando a pessoa tenta
// sair de uma tela com alteracoes nao salvas (useBlocker)
const roteador = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
      {/* Publica: o cliente (ou o tecnico) abre pelo link do WhatsApp, sem login */}
      <Route path="/aprovar/:token" element={<AprovarOS />} />

      {/* Tudo daqui pra baixo exige login */}
      <Route
        element={
          <RotaProtegida>
            <Layout />
          </RotaProtegida>
        }
      >
        <Route path="/" element={<Menu />} />
        <Route path="/os" element={<ConsultaOS />} />
        <Route path="/os/nova" element={<NovaOS />} />
        <Route path="/os/status" element={<RotaProtegida apenasGestor><GerenciarStatus /></RotaProtegida>} />
        <Route path="/os/termos" element={<RotaProtegida apenasGestor><TermosAprovacao /></RotaProtegida>} />
        <Route path="/os/:id" element={<DetalheOS />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/vendas/nova" element={<NovaVenda />} />
        <Route path="/vendas/:id" element={<DetalheVenda />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/mais" element={<Mais />} />
        <Route path="/itens" element={<Itens />} />
        <Route path="/itens/novo" element={<RotaProtegida apenasGestor><ItemForm /></RotaProtegida>} />
        <Route path="/itens/:id" element={<RotaProtegida apenasGestor><ItemForm /></RotaProtegida>} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/novo" element={<ClienteForm />} />
        <Route path="/clientes/:id" element={<ClienteForm />} />
        <Route path="/lojas" element={<Lojas />} />
        <Route path="/lojas/nova" element={<RotaProtegida apenasGestor><LojaForm /></RotaProtegida>} />
        <Route path="/lojas/:id" element={<RotaProtegida apenasGestor><LojaForm /></RotaProtegida>} />
        <Route path="/vendedores" element={<RotaProtegida apenasGestor><Vendedores /></RotaProtegida>} />
        <Route path="/vendedores/novo" element={<RotaProtegida apenasGestor><VendedorForm /></RotaProtegida>} />
        <Route path="/vendedores/:id" element={<RotaProtegida apenasGestor><VendedorForm /></RotaProtegida>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  )
);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={roteador} />
    </AuthProvider>
  );
}
