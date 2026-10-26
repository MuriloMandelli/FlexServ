import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth";
import { Icone } from "./Icones";
import { Marca, SimboloTF } from "./Marca";

type ItemMenu = { rotulo: string; para: string; icone: ReactNode; apenasGestor?: boolean; fim?: boolean };
type GrupoMenu = { titulo?: string; itens: ItemMenu[] };

// Menu principal: Servicos (OS de manutencao) separado de Vendas (balcao)
export const MENU: GrupoMenu[] = [
  { itens: [{ rotulo: "Início", para: "/", icone: <Icone.inicio />, fim: true }] },
  {
    titulo: "Serviços",
    itens: [
      { rotulo: "Nova OS", para: "/os/nova", icone: <Icone.mais_sinal /> },
      { rotulo: "Ordens de serviço", para: "/os", icone: <Icone.ferramenta />, fim: true },
    ],
  },
  {
    titulo: "Vendas",
    itens: [
      { rotulo: "Nova venda", para: "/vendas/nova", icone: <Icone.mais_sinal /> },
      { rotulo: "Vendas", para: "/vendas", icone: <Icone.venda />, fim: true },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { rotulo: "Clientes", para: "/clientes", icone: <Icone.clientes /> },
      { rotulo: "Peças e serviços", para: "/itens", icone: <Icone.itens /> },
      { rotulo: "Vendedores", para: "/vendedores", icone: <Icone.vendedores />, apenasGestor: true },
      { rotulo: "Lojas", para: "/lojas", icone: <Icone.lojas /> },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { rotulo: "Relatórios", para: "/relatorios", icone: <Icone.relatorios /> },
      { rotulo: "Status de OS", para: "/os/status", icone: <Icone.status />, apenasGestor: true },
      { rotulo: "Termos de aprovação", para: "/os/termos", icone: <Icone.termos />, apenasGestor: true },
    ],
  },
];

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

function Avatar({ nome }: { nome: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primaria to-primaria-forte text-sm font-bold text-fundo">
      {iniciais(nome)}
    </span>
  );
}

function LinkMenu({ item }: { item: ItemMenu }) {
  return (
    <NavLink
      to={item.para}
      end={item.fim}
      className={({ isActive }) =>
        `flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
          isActive ? "bg-primaria/15 text-primaria" : "text-suave hover:bg-superficie-2 hover:text-texto"
        }`
      }
    >
      {item.icone}
      {item.rotulo}
    </NavLink>
  );
}

// Barra inferior do celular
const ABAS = [
  { rotulo: "Início", para: "/", icone: <Icone.inicio tamanho={22} />, ativo: (p: string) => p === "/" },
  { rotulo: "Serviços", para: "/os", icone: <Icone.ferramenta tamanho={22} />, ativo: (p: string) => p.startsWith("/os") },
  { rotulo: "Vendas", para: "/vendas", icone: <Icone.venda tamanho={22} />, ativo: (p: string) => p.startsWith("/vendas") },
  { rotulo: "Relatórios", para: "/relatorios", icone: <Icone.relatorios tamanho={22} />, ativo: (p: string) => p.startsWith("/relatorios") },
  {
    rotulo: "Mais",
    para: "/mais",
    icone: <Icone.mais tamanho={22} />,
    ativo: (p: string) => ["/mais", "/clientes", "/itens", "/vendedores", "/lojas"].some((r) => p.startsWith(r)),
  },
];

export function Layout() {
  const { usuario, sair } = useAuth();
  const { pathname } = useLocation();
  const gestor = usuario?.papel === "gestor";

  return (
    <div className="min-h-dvh">
      {/* Menu lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-borda bg-fundo/80 backdrop-blur lg:flex">
        <div className="px-5 py-5">
          <NavLink to="/">
            <Marca />
          </NavLink>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {MENU.map((grupo, i) => (
            <div key={i}>
              {grupo.titulo && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-suave/70">
                  {grupo.titulo}
                </p>
              )}
              <div className="space-y-0.5">
                {grupo.itens
                  .filter((it) => !it.apenasGestor || gestor)
                  .map((it) => (
                    <LinkMenu key={it.para} item={it} />
                  ))}
              </div>
            </div>
          ))}
        </nav>
        {usuario && (
          <div className="flex items-center gap-3 border-t border-borda p-4">
            <Avatar nome={usuario.nome} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{usuario.nome}</p>
              <p className="text-xs capitalize text-suave">{usuario.papel}</p>
            </div>
            <button
              onClick={sair}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-suave hover:bg-superficie-2 hover:text-texto"
              aria-label="Sair"
              title="Sair"
            >
              <Icone.sair />
            </button>
          </div>
        )}
      </aside>

      {/* Cabecalho (celular e tablet) */}
      <header className="sticky top-0 z-30 border-b border-borda bg-fundo/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <NavLink to="/" className="flex items-center gap-2">
            <SimboloTF tamanho={30} />
            <span className="font-bold">
              Flex<span className="text-primaria">Serv</span>
            </span>
          </NavLink>
          {usuario && <Avatar nome={usuario.nome} />}
        </div>
      </header>

      <main className="px-4 pb-28 pt-5 sm:px-6 lg:ml-64 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Barra inferior (celular e tablet) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-fundo/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {ABAS.map((a) => {
            const ativo = a.ativo(pathname);
            return (
              <NavLink
                key={a.para}
                to={a.para}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  ativo ? "text-primaria" : "text-suave"
                }`}
              >
                {a.icone}
                {a.rotulo}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
