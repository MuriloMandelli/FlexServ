import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { useAuth } from "../auth";
import type { Loja } from "../types";
import { Aviso, Botao, CabecalhoPagina, Carregando, Vazio } from "../components/ui";

export default function Lojas() {
  const navegar = useNavigate();
  const gestor = useAuth().usuario?.papel === "gestor";
  const [lojas, setLojas] = useState<Loja[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api<Loja[]>("/lojas")
      .then(setLojas)
      .catch((err) => setErro(mensagemDeErro(err)));
  }, []);

  return (
    <div>
      <CabecalhoPagina
        titulo="Lojas"
        acao={gestor && <Botao onClick={() => navegar("/lojas/nova")}>+ Nova loja</Botao>}
      />

      {erro && <Aviso>{erro}</Aviso>}
      {!lojas && !erro && <Carregando />}
      {lojas?.length === 0 && <Vazio>Nenhuma loja cadastrada.</Vazio>}

      {/* Lista em cartoes: poucas colunas, funciona bem no celular e no computador */}
      <ul className="grid gap-2 sm:grid-cols-2">
        {lojas?.map((l) => {
          const conteudo = (
            <>
              <p className="font-semibold">{l.nome}</p>
              <p className="mt-1 text-sm text-suave">{l.endereco || "Sem endereço"}</p>
            </>
          );
          const estilo = "block rounded-2xl border border-borda bg-superficie p-4";
          return (
            <li key={l.id}>
              {gestor ? (
                <Link to={`/lojas/${l.id}`} className={`${estilo} hover:bg-superficie-2 active:bg-superficie-2`}>
                  {conteudo}
                </Link>
              ) : (
                <div className={estilo}>{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
