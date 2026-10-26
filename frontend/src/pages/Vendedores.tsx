import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import type { Loja, Vendedor } from "../types";
import { Aviso, Botao, CabecalhoPagina, Carregando, Vazio } from "../components/ui";

export default function Vendedores() {
  const navegar = useNavigate();
  const [vendedores, setVendedores] = useState<Vendedor[] | null>(null);
  const [lojas, setLojas] = useState<Record<number, string>>({});
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([api<Vendedor[]>("/vendedores"), api<Loja[]>("/lojas")])
      .then(([listaVendedores, listaLojas]) => {
        setVendedores(listaVendedores);
        setLojas(Object.fromEntries(listaLojas.map((l) => [l.id, l.nome])));
      })
      .catch((err) => setErro(mensagemDeErro(err)));
  }, []);

  return (
    <div>
      <CabecalhoPagina
        titulo="Vendedores"
        acao={<Botao onClick={() => navegar("/vendedores/novo")}>+ Novo vendedor</Botao>}
      />

      {erro && <Aviso>{erro}</Aviso>}
      {!vendedores && !erro && <Carregando />}
      {vendedores?.length === 0 && <Vazio>Nenhum vendedor cadastrado.</Vazio>}

      <ul className="grid gap-2 sm:grid-cols-2">
        {vendedores?.map((v) => (
          <li key={v.id}>
            <Link
              to={`/vendedores/${v.id}`}
              className="block rounded-2xl border border-borda bg-superficie p-4 hover:bg-superficie-2 active:bg-superficie-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{v.nome}</p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    v.papel === "gestor" ? "bg-primaria/15 text-primaria" : "bg-superficie-2 text-suave"
                  }`}
                >
                  {v.papel === "gestor" ? "Gestor" : "Vendedor"}
                </span>
              </div>
              <p className="mt-1 break-all text-sm text-suave">{v.email}</p>
              <p className="text-sm text-suave">{lojas[v.lojaId] ?? ""}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
