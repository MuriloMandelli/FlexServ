import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { useAuth } from "../auth";
import { CORES_STATUS, formatarData, formatarMoeda, ROTULO_ATENDIMENTO, dataLocalISO } from "../formatar";
import type { OSResumo, StatusOS } from "../types";
import { SeloPagamento, SeloStatus } from "../components/StatusOS";
import { Tabela } from "../components/Tabela";
import type { Coluna } from "../components/Tabela";
import { Icone } from "../components/Icones";
import { Aviso, Botao, Busca, CabecalhoPagina, Carregando, Filtros, Vazio } from "../components/ui";

const COLUNAS: Coluna<OSResumo>[] = [
  { titulo: "OS", valor: (o) => o.id, exibir: (o) => <span className="text-suave">#{o.id}</span>, pdf: (o) => `#${o.id}` },
  { titulo: "Cliente", valor: (o) => o.clienteNome, exibir: (o) => <span className="font-medium">{o.clienteNome}</span> },
  { titulo: "Técnico", valor: (o) => o.tecnicoNome ?? "", exibir: (o) => <span className="text-suave">{o.tecnicoNome ?? "-"}</span> },
  {
    titulo: "Atendimento",
    valor: (o) => ROTULO_ATENDIMENTO[o.tipoAtendimento],
    exibir: (o) => (
      <span className="inline-flex items-center gap-1 text-suave">
        {o.tipoAtendimento === "campo" && <Icone.campo tamanho={14} />}
        {ROTULO_ATENDIMENTO[o.tipoAtendimento]}
      </span>
    ),
  },
  { titulo: "Status", valor: (o) => o.status.nome, exibir: (o) => <SeloStatus nome={o.status.nome} cor={o.status.cor} /> },
  {
    titulo: "Pagamento",
    valor: (o) => (o.pagamentoStatus === "pago" ? "Pago" : "A receber"),
    exibir: (o) => <SeloPagamento status={o.pagamentoStatus} />,
  },
  { titulo: "Valor", valor: (o) => Number(o.valorTotal), exibir: (o) => formatarMoeda(o.valorTotal), pdf: (o) => formatarMoeda(o.valorTotal), direita: true },
  { titulo: "Abertura", valor: (o) => o.dataAbertura, exibir: (o) => <span className="text-suave">{formatarData(o.dataAbertura)}</span>, pdf: (o) => formatarData(o.dataAbertura) },
];

export default function ConsultaOS() {
  const navegar = useNavigate();
  const gestor = useAuth().usuario?.papel === "gestor";
  // Filtros ficam na URL: voltar do detalhe mantem a busca
  const [params, setParams] = useSearchParams();
  const statusId = params.get("status") ?? "todos";
  const tipo = params.get("tipo") ?? "";
  const pagamento = params.get("pagamento") ?? "";
  const [busca, setBusca] = useState(params.get("busca") ?? "");
  const [status, setStatus] = useState<StatusOS[]>([]);
  const [lista, setLista] = useState<OSResumo[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api<StatusOS[]>("/status").then(setStatus).catch(() => setStatus([]));
  }, []);

  useEffect(() => {
    const espera = setTimeout(() => {
      const query = new URLSearchParams();
      if (statusId !== "todos") query.set("statusId", statusId);
      if (tipo) query.set("tipo", tipo);
      if (pagamento) query.set("pagamento", pagamento);
      if (busca.trim()) query.set("busca", busca.trim());

      // Atualiza a URL (sem gerar historico)
      const naUrl = new URLSearchParams();
      if (statusId !== "todos") naUrl.set("status", statusId);
      if (tipo) naUrl.set("tipo", tipo);
      if (pagamento) naUrl.set("pagamento", pagamento);
      if (busca.trim()) naUrl.set("busca", busca.trim());
      setParams(naUrl, { replace: true });

      api<OSResumo[]>(`/os?${query}`)
        .then((r) => {
          setLista(r);
          setErro("");
        })
        .catch((err) => setErro(mensagemDeErro(err)));
    }, 250);
    return () => clearTimeout(espera);
  }, [statusId, tipo, pagamento, busca, setParams]);

  function mudarFiltro(nome: string, valor: string) {
    const query = new URLSearchParams(params);
    if (!valor || valor === "todos") query.delete(nome);
    else query.set(nome, valor);
    setParams(query, { replace: true });
  }

  const opcoesStatus = useMemo(
    () => [
      { valor: "todos", rotulo: "Todos" },
      ...status.filter((s) => s.ativo).map((s) => ({ valor: String(s.id), rotulo: s.nome, cor: CORES_STATUS[s.cor].hex })),
    ],
    [status]
  );

  // Texto dos filtros aplicados, para o PDF
  const descricaoFiltros = [
    statusId !== "todos" && status.find((s) => String(s.id) === statusId)?.nome,
    tipo && ROTULO_ATENDIMENTO[tipo as "oficina" | "campo"],
    pagamento && (pagamento === "pago" ? "Pagas" : "A receber"),
    busca.trim() && `Busca: "${busca.trim()}"`,
  ]
    .filter(Boolean)
    .join(" · ");
  const totalValor = (lista ?? []).reduce((s, o) => s + Number(o.valorTotal), 0);

  return (
    <div>
      <CabecalhoPagina
        titulo="Ordens de serviço"
        subtitulo="Manutenção na oficina e em campo"
        acao={
          <Botao onClick={() => navegar("/os/nova")}>
            <Icone.mais_sinal tamanho={18} /> Nova OS
          </Botao>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar pelo cliente ou nº da OS" className="sm:max-w-md sm:flex-1" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select
              value={tipo}
              onChange={(e) => mudarFiltro("tipo", e.target.value)}
              className="min-h-11 rounded-xl border border-borda bg-superficie px-3 text-sm"
              aria-label="Tipo de atendimento"
            >
              <option value="">Oficina e campo</option>
              <option value="oficina">Só oficina</option>
              <option value="campo">Só em campo</option>
            </select>
            <select
              value={pagamento}
              onChange={(e) => mudarFiltro("pagamento", e.target.value)}
              className="min-h-11 rounded-xl border border-borda bg-superficie px-3 text-sm"
              aria-label="Pagamento"
            >
              <option value="">Qualquer pagamento</option>
              <option value="pendente">A receber</option>
              <option value="pago">Pagas</option>
            </select>
          </div>
        </div>
        <Filtros
          opcoes={opcoesStatus}
          valor={statusId}
          aoMudar={(v) => mudarFiltro("status", v)}
          extra={
            gestor && (
              <>
                <Link
                  to="/os/status"
                  title="Adicionar ou editar status"
                  className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-borda px-4 text-sm font-medium text-suave hover:border-primaria hover:text-primaria"
                >
                  <Icone.status tamanho={16} /> Gerenciar status
                </Link>
                <Link
                  to="/os/termos"
                  title="Texto aceito pelo cliente e pelo técnico na aprovação"
                  className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-borda px-4 text-sm font-medium text-suave hover:border-primaria hover:text-primaria"
                >
                  <Icone.termos tamanho={16} /> Termos de aprovação
                </Link>
              </>
            )
          }
        />
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {!lista && !erro && <Carregando />}
      {lista?.length === 0 && <Vazio>Nenhuma OS encontrada com esses filtros.</Vazio>}

      {lista && lista.length > 0 && (
        <Tabela
          colunas={COLUNAS}
          linhas={lista}
          chave={(o) => o.id}
          aoClicar={(o) => navegar(`/os/${o.id}`)}
          pdf={{
            titulo: "Relatório de ordens de serviço",
            subtitulo: descricaoFiltros || "Todas as OS",
            nomeArquivo: `ordens-de-servico-${dataLocalISO()}`,
            resumo: `${lista.length} OS · Valor total: ${formatarMoeda(totalValor)}`,
          }}
          cartao={(o) => (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 font-semibold">
                  <span className="text-suave">#{o.id}</span> {o.clienteNome}
                </p>
                <SeloStatus nome={o.status.nome} cor={o.status.cor} />
              </div>
              <p className="mt-1 flex items-center gap-1 truncate text-sm text-suave">
                {o.tipoAtendimento === "campo" && <Icone.campo tamanho={14} />}
                {ROTULO_ATENDIMENTO[o.tipoAtendimento]}{o.tecnicoNome ? ` · ${o.tecnicoNome}` : ""}
              </p>
              <div className="mt-2 flex items-end justify-between">
                <span className="flex items-center gap-2 text-sm text-suave">
                  {formatarData(o.dataAbertura)} <SeloPagamento status={o.pagamentoStatus} />
                </span>
                <span className="font-semibold tabular-nums">{formatarMoeda(o.valorTotal)}</span>
              </div>
            </>
          )}
        />
      )}
    </div>
  );
}
