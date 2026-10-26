import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { formatarCpfCnpj, dataLocalISO } from "../formatar";
import type { Cliente } from "../types";
import { Tabela } from "../components/Tabela";
import type { Coluna } from "../components/Tabela";
import { Icone } from "../components/Icones";
import { Aviso, Botao, Busca, CabecalhoPagina, Carregando, Vazio } from "../components/ui";

const COLUNAS: Coluna<Cliente>[] = [
  { titulo: "Nome", valor: (c) => c.nome, exibir: (c) => <span className="font-medium">{c.nome}</span> },
  { titulo: "CPF/CNPJ", valor: (c) => formatarCpfCnpj(c.cpfCnpj), exibir: (c) => <span className="text-suave">{formatarCpfCnpj(c.cpfCnpj)}</span> },
  { titulo: "Telefone", valor: (c) => c.telefone ?? "", exibir: (c) => <span className="text-suave">{c.telefone}</span> },
  { titulo: "E-mail", valor: (c) => c.email ?? "", exibir: (c) => <span className="text-suave">{c.email}</span> },
  { titulo: "Cidade", valor: (c) => c.cidade ?? "", exibir: (c) => <span className="text-suave">{c.cidade}</span> },
];

export default function Clientes() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [erro, setErro] = useState("");

  // Busca na API 250ms depois que a pessoa para de digitar
  useEffect(() => {
    const espera = setTimeout(() => {
      const filtro = busca.trim() ? `?busca=${encodeURIComponent(busca.trim())}` : "";
      api<Cliente[]>(`/clientes${filtro}`)
        .then((lista) => {
          setClientes(lista);
          setErro("");
        })
        .catch((err) => setErro(mensagemDeErro(err)));
    }, 250);
    return () => clearTimeout(espera);
  }, [busca]);

  return (
    <div>
      <CabecalhoPagina
        titulo="Clientes"
        subtitulo="Pessoas e empresas atendidas"
        acao={
          <Botao onClick={() => navegar("/clientes/novo")}>
            <Icone.mais_sinal tamanho={18} /> Novo cliente
          </Botao>
        }
      />

      <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar por nome ou CPF/CNPJ" className="mb-4 sm:max-w-md" />

      {erro && <Aviso>{erro}</Aviso>}
      {!clientes && !erro && <Carregando />}
      {clientes?.length === 0 && <Vazio>{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</Vazio>}

      {clientes && clientes.length > 0 && (
        <Tabela
          colunas={COLUNAS}
          linhas={clientes}
          chave={(c) => c.id}
          aoClicar={(c) => navegar(`/clientes/${c.id}`)}
          pdf={{
            titulo: "Relatório de clientes",
            subtitulo: busca.trim() ? `Busca: "${busca.trim()}"` : "Todos os clientes",
            nomeArquivo: `clientes-${dataLocalISO()}`,
          }}
          cartao={(c) => (
            <>
              <p className="font-semibold">{c.nome}</p>
              <p className="mt-1 text-sm text-suave">
                {[formatarCpfCnpj(c.cpfCnpj), c.telefone, c.cidade].filter(Boolean).join(" · ") || "Sem dados de contato"}
              </p>
            </>
          )}
        />
      )}
    </div>
  );
}
