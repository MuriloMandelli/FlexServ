import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import type { Loja } from "../types";
import { Aviso, Botao, CabecalhoPagina, Campo, Carregando, Cartao } from "../components/ui";

export default function LojaForm() {
  const { id } = useParams();
  const editando = id !== undefined;
  const navegar = useNavigate();

  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!editando) return;
    api<Loja>(`/lojas/${id}`)
      .then((l) => {
        setNome(l.nome);
        setEndereco(l.endereco ?? "");
      })
      .catch((err) => setErro(mensagemDeErro(err)))
      .finally(() => setCarregando(false));
  }, [editando, id]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const dados = { nome, endereco };
      if (editando) await api(`/lojas/${id}`, "PUT", dados);
      else await api("/lojas", "POST", dados);
      navegar("/lojas");
    } catch (err) {
      setErro(mensagemDeErro(err));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!confirm(`Excluir a loja "${nome}"?`)) return;
    setErro("");
    try {
      await api(`/lojas/${id}`, "DELETE");
      navegar("/lojas");
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina titulo={editando ? "Editar loja" : "Nova loja"} voltarPara="/lojas" voltarRotulo="Lojas" />

      {carregando ? (
        <Carregando />
      ) : (
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Cartao className="flex flex-col gap-4 p-4 sm:p-5">
            <Campo rotulo="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Campo rotulo="Endereço" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </Cartao>

          {erro && <Aviso>{erro}</Aviso>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {editando ? (
              <Botao type="button" variante="perigo" onClick={excluir}>
                Excluir
              </Botao>
            ) : (
              <span />
            )}
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar loja"}
            </Botao>
          </div>
        </form>
      )}
    </div>
  );
}
