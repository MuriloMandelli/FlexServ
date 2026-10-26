import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { formatarCep, formatarCpfCnpj } from "../formatar";
import type { Cliente } from "../types";
import { Aviso, Botao, CabecalhoPagina, Campo, Carregando, Cartao } from "../components/ui";
import { MaquinasCliente } from "../components/MaquinasCliente";

const vazio = { nome: "", cpfCnpj: "", telefone: "", email: "", endereco: "", cidade: "", cep: "" };
type Formulario = typeof vazio;

// Serve tanto para cadastrar (/clientes/novo) quanto para editar (/clientes/:id)
export default function ClienteForm() {
  const { id } = useParams();
  const editando = id !== undefined;
  const navegar = useNavigate();

  const [form, setForm] = useState<Formulario>(vazio);
  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!editando) return;
    api<Cliente>(`/clientes/${id}`)
      .then((c) =>
        setForm({
          nome: c.nome,
          cpfCnpj: formatarCpfCnpj(c.cpfCnpj),
          telefone: c.telefone ?? "",
          email: c.email ?? "",
          endereco: c.endereco ?? "",
          cidade: c.cidade ?? "",
          cep: formatarCep(c.cep),
        })
      )
      .catch((err) => setErro(mensagemDeErro(err)))
      .finally(() => setCarregando(false));
  }, [editando, id]);

  function alterar(campo: keyof Formulario, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      // O back-end limpa pontos/tracos e valida tudo de novo
      if (editando) await api(`/clientes/${id}`, "PUT", form);
      else await api("/clientes", "POST", form);
      navegar("/clientes");
    } catch (err) {
      setErro(mensagemDeErro(err));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!confirm(`Excluir o cliente "${form.nome}"?`)) return;
    setErro("");
    try {
      await api(`/clientes/${id}`, "DELETE");
      navegar("/clientes");
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina
        titulo={editando ? "Editar cliente" : "Novo cliente"}
        voltarPara="/clientes"
        voltarRotulo="Clientes"
      />

      {carregando ? (
        <Carregando />
      ) : (
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Cartao className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Campo
              rotulo="Nome *"
              className="sm:col-span-2"
              value={form.nome}
              onChange={(e) => alterar("nome", e.target.value)}
              placeholder="Nome da pessoa ou empresa"
              required
            />
            <Campo
              rotulo="CPF ou CNPJ"
              inputMode="numeric"
              value={form.cpfCnpj}
              onChange={(e) => alterar("cpfCnpj", e.target.value)}
              placeholder="Somente números"
            />
            <Campo
              rotulo="Telefone"
              type="tel"
              inputMode="tel"
              value={form.telefone}
              onChange={(e) => alterar("telefone", e.target.value)}
              placeholder="(48) 99999-0000"
            />
            <Campo
              rotulo="E-mail"
              type="email"
              inputMode="email"
              className="sm:col-span-2"
              value={form.email}
              onChange={(e) => alterar("email", e.target.value)}
            />
          </Cartao>

          <Cartao className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Campo
              rotulo="Endereço"
              className="sm:col-span-2"
              value={form.endereco}
              onChange={(e) => alterar("endereco", e.target.value)}
              placeholder="Rua, número, bairro"
            />
            <Campo rotulo="Cidade" value={form.cidade} onChange={(e) => alterar("cidade", e.target.value)} />
            <Campo
              rotulo="CEP"
              inputMode="numeric"
              value={form.cep}
              onChange={(e) => alterar("cep", e.target.value)}
              placeholder="88800-000"
            />
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
              {salvando ? "Salvando..." : "Salvar cliente"}
            </Botao>
          </div>
        </form>
      )}

      {/* Historico e maquinas so aparecem depois que o cliente existe */}
      {editando && !carregando && (
        <div className="mt-6 flex flex-col gap-4">
          <MaquinasCliente clienteId={Number(id)} />
        </div>
      )}
    </div>
  );
}
