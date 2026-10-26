import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { formatarData, formatarMoeda, ROTULO_PAGAMENTO, dataLocalISO } from "../formatar";
import type { VendaResumo } from "../types";
import { SeloPagamento, SeloStatus } from "../components/StatusOS";
import { Tabela } from "../components/Tabela";
import type { Coluna } from "../components/Tabela";
import { Icone } from "../components/Icones";
import { Aviso, Botao, Busca, CabecalhoPagina, Carregando, Filtros, Vazio } from "../components/ui";

const COLUNAS: Coluna<VendaResumo>[] = [
  { titulo: "Venda", valor: (v) => v.id, exibir: (v) => <span className="text-suave">#{v.id}</span>, pdf: (v) => `#${v.id}` },
  { titulo: "Data", valor: (v) => v.data, exibir: (v) => formatarData(v.data), pdf: (v) => formatarData(v.data) },
  { titulo: "Cliente", valor: (v) => v.clienteNome, exibir: (v) => <span className="font-medium">{v.clienteNome}</span> },
  { titulo: "Itens", valor: (v) => v.quantidadeItens, direita: true },
  {
    titulo: "Pagamento",
    valor: (v) => (v.formaPagamento ? ROTULO_PAGAMENTO[v.formaPagamento] : "-"),
    exibir: (v) => (
      <span className="flex items-center gap-2">
        <SeloPagamento status={v.pagamentoStatus} />
        <span className="text-suave">{v.formaPagamento ? ROTULO_PAGAMENTO[v.formaPagamento] : ""}</span>
      </span>
    ),
    pdf: (v) => `${v.pagamentoStatus === "pago" ? "Pago" : "A receber"}${v.formaPagamento ? ` (${ROTULO_PAGAMENTO[v.formaPagamento]})` : ""}`,
  },
  {
    titulo: "Situação",
    valor: (v) => (v.status === "cancelada" ? "Cancelada" : "Concluída"),
    exibir: (v) => (v.status === "cancelada" ? <SeloStatus nome="Cancelada" cor="vermelho" /> : <SeloStatus nome="Concluída" cor="verde" />),
  },
  { titulo: "Vendedor", valor: (v) => v.vendedorNome, exibir: (v) => <span className="text-suave">{v.vendedorNome}</span> },
  { titulo: "Total", valor: (v) => Number(v.valorTotal), exibir: (v) => formatarMoeda(v.valorTotal), pdf: (v) => formatarMoeda(v.valorTotal), direita: true },
];

type Filtro = "todas" | "pendente" | "canceladas";

export default function Vendas() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [lista, setLista] = useState<VendaResumo[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const espera = setTimeout(() => {
      const q = new URLSearchParams();
      if (busca.trim()) q.set("busca", busca.trim());
      if (filtro === "pendente") q.set("pagamento", "pendente");
      if (filtro === "canceladas") q.set("status", "cancelada");
      api<VendaResumo[]>(`/vendas?${q}`)
        .then((r) => {
          setLista(r);
          setErro("");
        })
        .catch((err) => setErro(mensagemDeErro(err)));
    }, 250);
    return () => clearTimeout(espera);
  }, [busca, filtro]);

  const validas = (lista ?? []).filter((v) => v.status !== "cancelada");
  const total = validas.reduce((s, v) => s + Number(v.valorTotal), 0);

  return (
    <div>
      <CabecalhoPagina
        titulo="Vendas"
        subtitulo="Venda de peças e máquinas no balcão"
        acao={
          <Botao onClick={() => navegar("/vendas/nova")}>
            <Icone.mais_sinal tamanho={18} /> Nova venda
          </Botao>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar pelo cliente ou nº da venda" className="sm:max-w-md" />
        <Filtros
          opcoes={[
            { valor: "todas", rotulo: "Todas" },
            { valor: "pendente", rotulo: "A receber" },
            { valor: "canceladas", rotulo: "Canceladas" },
          ]}
          valor={filtro}
          aoMudar={setFiltro}
        />
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {!lista && !erro && <Carregando />}
      {lista?.length === 0 && <Vazio>Nenhuma venda encontrada.</Vazio>}

      {lista && lista.length > 0 && (
        <Tabela
          colunas={COLUNAS}
          linhas={lista}
          chave={(v) => v.id}
          aoClicar={(v) => navegar(`/vendas/${v.id}`)}
          pdf={{
            titulo: "Relatório de vendas",
            subtitulo: { todas: "Todas as vendas", pendente: "Vendas a receber", canceladas: "Vendas canceladas" }[filtro],
            nomeArquivo: `vendas-${dataLocalISO()}`,
            resumo: `${lista.length} venda(s) · Total (sem canceladas): ${formatarMoeda(total)}`,
          }}
          cartao={(v) => (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 font-semibold">
                  <span className="text-suave">#{v.id}</span> {v.clienteNome}
                </p>
                {v.status === "cancelada" ? <SeloStatus nome="Cancelada" cor="vermelho" /> : <SeloPagamento status={v.pagamentoStatus} />}
              </div>
              <p className="mt-1 text-sm text-suave">
                {v.quantidadeItens} {v.quantidadeItens === 1 ? "item" : "itens"}
                {v.formaPagamento ? ` · ${ROTULO_PAGAMENTO[v.formaPagamento]}` : ""}
              </p>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-sm text-suave">{formatarData(v.data)}</span>
                <span className="font-semibold tabular-nums">{formatarMoeda(v.valorTotal)}</span>
              </div>
            </>
          )}
        />
      )}
    </div>
  );
}
