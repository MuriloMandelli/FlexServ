import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { useAuth } from "../auth";
import {
  dataHoraParaISO,
  paraCampoValor,
  paraNumero,
  formatarCpfCnpj,
  formatarData,
  formatarDataHora,
  formatarDataSimples,
  formatarMoeda,
  ROTULO_ATENDIMENTO,
  ROTULO_FASE,
  ROTULO_PAGAMENTO,
  ROTULO_TIPO_EQUIPAMENTO,
  ROTULO_TIPO_ITEM,
} from "../formatar";
import type { Fase, FormaPagamento, Item, MembroEquipe, OSDetalhe, PagamentoStatus, StatusOS, TipoAtendimento } from "../types";
import { abrirParaImprimir, compartilharPdf, gerarPdfOS } from "../pdf";
import { SeloPagamento, SeloStatus } from "../components/StatusOS";
import { Quantidade, SeletorItem } from "../components/Seletores";
import { BotaoWhatsApp, HistoricoAvisos } from "../components/WhatsApp";
import { PainelAprovacao } from "../components/AprovacaoOS";
import { LinhaDoTempoOS } from "../components/LinhaDoTempoOS";
import { Icone } from "../components/Icones";
import {
  AreaTexto,
  Aviso,
  Botao,
  CabecalhoPagina,
  Campo,
  CampoSelecao,
  CampoValorLinha,
  Carregando,
  Secao,
} from "../components/ui";

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-suave">{rotulo}</dt>
      <dd className="break-words">{children || "-"}</dd>
    </div>
  );
}

// "2026-10-20T14:30:00.000Z" -> valor do campo datetime-local no horario local
function paraCampoDataHora(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Valores dos formularios a partir da OS (para preencher e comparar)
function formAtendimento(d: OSDetalhe) {
  return {
    tipoAtendimento: d.tipoAtendimento,
    enderecoAtendimento: d.enderecoAtendimento ?? "",
    dataVisita: paraCampoDataHora(d.dataVisita),
    defeitoRelatado: d.defeitoRelatado ?? "",
    diagnostico: d.diagnostico ?? "",
    servicoExecutado: d.servicoExecutado ?? "",
    observacoes: d.observacoes ?? "",
    previsaoEntrega: d.previsaoEntrega ?? "",
    garantiaDias: d.garantiaDias?.toString() ?? "",
    tecnicoId: String(d.tecnico.id),
  };
}

function formPagamento(d: OSDetalhe) {
  return {
    desconto: Number(d.desconto).toFixed(2).replace(".", ","),
    formaPagamento: (d.formaPagamento ?? "") as FormaPagamento | "",
    pagamentoStatus: d.pagamentoStatus as PagamentoStatus,
  };
}

const iguais = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

// Proximo passo natural de cada fase (botao principal da OS)
const PROXIMO_PASSO: Partial<Record<Fase, { fase: Fase; rotulo: string; confirmar?: string }>> = {
  aberta: { fase: "execucao", rotulo: "Iniciar serviço" },
  execucao: { fase: "concluida", rotulo: "Concluir serviço" },
  concluida: { fase: "entregue", rotulo: "Registrar entrega", confirmar: "Confirmar a entrega ao cliente? A OS será finalizada." },
};

export default function DetalheOS() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const [os, setOs] = useState<OSDetalhe | null>(null);
  const [status, setStatus] = useState<StatusOS[]>([]);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [escolhendoItem, setEscolhendoItem] = useState(false);
  const [novoStatus, setNovoStatus] = useState("");
  const [mensagem, setMensagem] = useState("");
  // Valores sendo digitados nos itens de valor variavel (id da linha -> texto)
  const [valoresItens, setValoresItens] = useState<Record<number, string>>({});

  // Formularios
  const [atendimento, setAtendimento] = useState({
    tipoAtendimento: "oficina" as TipoAtendimento,
    enderecoAtendimento: "",
    dataVisita: "",
    defeitoRelatado: "",
    diagnostico: "",
    servicoExecutado: "",
    observacoes: "",
    previsaoEntrega: "",
    garantiaDias: "",
    tecnicoId: "",
  });
  const [pagamento, setPagamento] = useState({
    desconto: "0",
    formaPagamento: "" as FormaPagamento | "",
    pagamentoStatus: "pendente" as PagamentoStatus,
  });

  const carregar = useCallback((dados: OSDetalhe) => {
    setOs(dados);
    setNovoStatus("");
    setAtendimento(formAtendimento(dados));
    setPagamento(formPagamento(dados));
  }, []);

  useEffect(() => {
    api<OSDetalhe>(`/os/${id}`)
      .then(carregar)
      .catch((err) => setErro(mensagemDeErro(err)));
    api<StatusOS[]>("/status").then(setStatus).catch(() => setStatus([]));
    api<MembroEquipe[]>("/equipe").then(setEquipe).catch(() => setEquipe([]));
  }, [id, carregar]);

  // Alteracoes digitadas e ainda nao salvas
  const atendimentoAlterado = os !== null && !iguais(atendimento, formAtendimento(os));
  const pagamentoAlterado = os !== null && !iguais(pagamento, formPagamento(os));
  const alterado = atendimentoAlterado || pagamentoAlterado;

  // Avisa antes de sair da tela (navegacao no sistema ou fechar a aba)
  const bloqueio = useBlocker(({ currentLocation, nextLocation }) => alterado && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (bloqueio.state !== "blocked") return;
    if (confirm("Há alterações não salvas nesta OS. Sair mesmo assim?")) bloqueio.proceed();
    else bloqueio.reset();
  }, [bloqueio]);
  useEffect(() => {
    if (!alterado) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  // Enquanto espera as assinaturas, confere a cada 15s se alguem assinou.
  // Atualiza so a OS, sem apagar o que estiver sendo digitado nos formularios.
  const aguardandoAssinatura = os !== null && os.status.fase === "aberta" && !os.aprovada && Boolean(os.tokenCliente);
  const osRef = useRef(os);
  useEffect(() => {
    osRef.current = os;
  }, [os]);
  useEffect(() => {
    if (!aguardandoAssinatura) return;
    const timer = setInterval(async () => {
      try {
        const nova = await api<OSDetalhe>(`/os/${id}`);
        const atual = osRef.current;
        if (atual && (nova.aceiteClienteEm !== atual.aceiteClienteEm || nova.aceiteTecnicoEm !== atual.aceiteTecnicoEm)) {
          setOs(nova);
          if (nova.aprovada) setMensagem("OS aprovada pelo cliente e pelo técnico. O serviço já pode começar.");
        }
      } catch {
        // silencioso: tenta de novo no proximo ciclo
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [aguardandoAssinatura, id]);

  // Executa uma chamada que devolve a OS atualizada
  async function executar(acao: () => Promise<OSDetalhe>, sucesso?: string) {
    setErro("");
    setMensagem("");
    setOcupado(true);
    try {
      carregar(await acao());
      if (sucesso) setMensagem(sucesso);
      return true;
    } catch (err) {
      setErro(mensagemDeErro(err));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function mudarStatus() {
    const escolhido = status.find((s) => String(s.id) === novoStatus);
    if (!escolhido) return;
    if (escolhido.fase === "cancelada" && !confirm("Cancelar esta OS? Depois disso ela não poderá mais ser alterada.")) return;
    if (escolhido.fase === "entregue" && !confirm("Confirmar a entrega da máquina ao cliente? A OS será finalizada.")) return;
    executar(() => api<OSDetalhe>(`/os/${id}/status`, "PATCH", { statusId: escolhido.id }), `Status alterado para "${escolhido.nome}".`);
  }

  function salvarAtendimento(e: FormEvent) {
    e.preventDefault();
    executar(
      () => api<OSDetalhe>(`/os/${id}`, "PUT", { ...atendimento, dataVisita: dataHoraParaISO(atendimento.dataVisita) }),
      "Atendimento salvo."
    );
  }

  // A previsao de entrega herda a data da visita, a menos que ja tenha
  // sido definida com outra data
  function mudarDataVisita(valor: string) {
    const previsaoSeguiaVisita = !atendimento.previsaoEntrega || atendimento.previsaoEntrega === atendimento.dataVisita.slice(0, 10);
    setAtendimento({
      ...atendimento,
      dataVisita: valor,
      ...(previsaoSeguiaVisita ? { previsaoEntrega: valor.slice(0, 10) } : {}),
    });
  }

  // Item de valor variavel: salva o valor digitado ao sair do campo
  function salvarValorItem(itemOsId: number, atual: string) {
    const digitado = valoresItens[itemOsId];
    if (digitado === undefined) return;
    setValoresItens((atual) => {
      const copia = { ...atual };
      delete copia[itemOsId];
      return copia;
    });
    if (paraNumero(digitado) === Number(atual)) return;
    executar(() => api<OSDetalhe>(`/os/${id}/itens/${itemOsId}`, "PUT", { valorUnitario: paraNumero(digitado) }));
  }

  function salvarPagamento(e: FormEvent) {
    e.preventDefault();
    executar(
      () => api<OSDetalhe>(`/os/${id}/pagamento`, "PUT", { ...pagamento, formaPagamento: pagamento.formaPagamento || null }),
      "Valores e pagamento salvos."
    );
  }

  function adicionarItem(item: Item) {
    setEscolhendoItem(false);
    executar(() => api<OSDetalhe>(`/os/${id}/itens`, "POST", { itemId: item.id, quantidade: 1 }));
  }

  async function pdf(acao: "imprimir" | "compartilhar") {
    if (!os) return;
    const doc = await gerarPdfOS(os);
    if (acao === "imprimir") abrirParaImprimir(doc);
    else await compartilharPdf(doc, `OS-${os.id}-TecFlex`, `Ordem de serviço #${os.id} - TecFlex`);
  }

  if (!os) {
    return (
      <div>
        <CabecalhoPagina titulo="OS" voltarPara="/os" voltarRotulo="Ordens de serviço" />
        {erro ? <Aviso>{erro}</Aviso> : <Carregando />}
      </div>
    );
  }

  const fase = os.status.fase;
  const m = os.equipamento;
  const maquina = m ? `${m.marca} ${m.modelo}` : null;
  const primeiroNome = os.cliente.nome.split(" ")[0];
  // Status para onde pode ir (o back-end valida as regras de verdade)
  const opcoesStatus = status.filter((s) => s.ativo && s.id !== os.status.id);
  const fasesComOpcoes = (Object.keys(ROTULO_FASE) as Fase[]).filter((f) => opcoesStatus.some((s) => s.fase === f));

  // Botao principal: o proximo passo natural da OS (primeiro status ativo da proxima fase)
  const passo = PROXIMO_PASSO[fase];
  const statusDoPasso =
    passo && (fase !== "aberta" || os.aprovada)
      ? status.filter((s) => s.ativo && s.fase === passo.fase).sort((a, b) => a.ordem - b.ordem)[0]
      : undefined;

  const modelosWhats = [
    {
      rotulo: "Orçamento",
      texto: `Olá ${primeiroNome}! Aqui é da TecFlex. O orçamento da OS #${os.id} ficou em ${formatarMoeda(os.valorTotal)}. Podemos seguir com o serviço?`,
    },
    {
      rotulo: "Serviço pronto",
      texto: `Olá ${primeiroNome}! O serviço da OS #${os.id} está pronto${os.tipoAtendimento === "oficina" ? " para retirada na TecFlex" : ""}. Valor: ${formatarMoeda(os.valorTotal)}.`,
    },
    ...(os.tipoAtendimento === "campo"
      ? [
          {
            rotulo: "Visita técnica",
            texto: `Olá ${primeiroNome}! Confirmando a visita técnica da TecFlex${os.dataVisita ? ` em ${formatarDataHora(os.dataVisita)}` : ""}${os.enderecoAtendimento ? ` no endereço ${os.enderecoAtendimento}` : ""}.`,
          },
        ]
      : []),
    {
      rotulo: "Atualização",
      texto: `Olá ${primeiroNome}! Atualização da sua OS #${os.id} na TecFlex: ${os.status.nome}.`,
    },
  ];

  return (
    <div>
      <CabecalhoPagina
        titulo={`OS #${os.id}`}
        subtitulo={`${os.cliente.nome} · ${ROTULO_ATENDIMENTO[os.tipoAtendimento]}`}
        voltarPara="/os"
        voltarRotulo="Ordens de serviço"
        acao={
          <>
            <Botao variante="secundario" pequeno onClick={() => pdf("imprimir")}>
              <Icone.imprimir tamanho={16} /> Imprimir
            </Botao>
            <Botao variante="secundario" pequeno onClick={() => pdf("compartilhar")}>
              <Icone.compartilhar tamanho={16} /> PDF
            </Botao>
            <BotaoWhatsApp
              pequeno
              telefone={os.cliente.telefone}
              modelos={modelosWhats}
              aoConfirmar={(msg) =>
                executar(() => api<OSDetalhe>(`/os/${id}/avisos`, "POST", { mensagem: msg }), "Aviso registrado.")
              }
            />
          </>
        }
      />

      {erro && (
        <div className="mb-4">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      {mensagem && (
        <div className="mb-4">
          <Aviso tipo="sucesso">{mensagem}</Aviso>
        </div>
      )}

      <LinhaDoTempoOS os={os} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Coluna principal */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Situacao */}
          <Secao
            titulo="Situação"
            acao={
              <div className="flex items-center gap-2">
                <SeloStatus nome={os.status.nome} cor={os.status.cor} />
                <SeloPagamento status={os.pagamentoStatus} />
              </div>
            }
          >
            {/* Aprovacao eletronica (cliente e tecnico) */}
            {(fase === "aberta" || os.aprovada) && (
              <PainelAprovacao os={os} usuarioId={usuario?.id} ocupado={ocupado} executar={executar} />
            )}

            {os.finalizada ? (
              <p className="text-sm text-suave">
                Esta OS foi {fase === "entregue" ? "entregue" : "cancelada"} e agora é um registro histórico.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {passo && statusDoPasso && (
                  <Botao
                    disabled={ocupado}
                    onClick={() => {
                      if (passo.confirmar && !confirm(passo.confirmar)) return;
                      executar(
                        () => api<OSDetalhe>(`/os/${id}/status`, "PATCH", { statusId: statusDoPasso.id }),
                        `Status alterado para "${statusDoPasso.nome}".`
                      );
                    }}
                    className="w-full sm:w-auto sm:self-start"
                  >
                    <Icone.check tamanho={18} /> {passo.rotulo}
                  </Botao>
                )}
                <details>
                  <summary className="cursor-pointer text-sm text-suave hover:text-texto">Mudar para outro status</summary>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <select
                      value={novoStatus}
                      onChange={(e) => setNovoStatus(e.target.value)}
                      className="min-h-11 flex-1 rounded-xl border border-borda bg-fundo/70 px-3"
                      aria-label="Novo status"
                    >
                      <option value="">Escolha o status...</option>
                      {fasesComOpcoes.map((f) => (
                        <optgroup key={f} label={ROTULO_FASE[f]}>
                          {opcoesStatus
                            .filter((s) => s.fase === f)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nome}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                    <Botao variante="secundario" onClick={mudarStatus} disabled={!novoStatus || ocupado}>
                      Alterar status
                    </Botao>
                  </div>
                </details>
              </div>
            )}
          </Secao>

          {/* Itens */}
          <Secao
            titulo="Peças e serviços"
            acao={
              os.itensEditaveis &&
              !escolhendoItem && (
                <Botao variante="secundario" pequeno onClick={() => setEscolhendoItem(true)}>
                  <Icone.mais_sinal tamanho={16} /> Adicionar item
                </Botao>
              )
            }
          >
            {escolhendoItem && (
              <div className="mb-3">
                <SeletorItem aoEscolher={adicionarItem} />
                <button type="button" className="mt-2 text-sm text-suave" onClick={() => setEscolhendoItem(false)}>
                  Fechar busca
                </button>
              </div>
            )}
            {fase === "aberta" && (os.aprovada || os.tokenCliente) && os.itensEditaveis && (
              <p className="mb-3 text-xs text-suave">Mudar itens agora cancela a aprovação: cliente e técnico precisarão assinar de novo.</p>
            )}

            {os.itens.length === 0 ? (
              <p className="rounded-xl border border-dashed border-borda px-3 py-5 text-center text-sm text-suave">Nenhum item lançado.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borda">
                {os.itens.map((i) => (
                  <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0 sm:flex-1">
                      <p className="font-medium sm:truncate">{i.nome}</p>
                      <p className="text-xs text-suave">
                        {ROTULO_TIPO_ITEM[i.tipo]} · {formatarMoeda(i.valorUnitario)} cada
                        {i.valorVariavel && " · valor variável"}
                      </p>
                      {os.itensEditaveis && i.valorVariavel && (
                        <div className="mt-2 w-fit">
                          <CampoValorLinha
                            rotulo={`Valor de ${i.nome}`}
                            valor={valoresItens[i.id] ?? (Number(i.valorUnitario) ? paraCampoValor(i.valorUnitario) : "")}
                            desabilitado={ocupado}
                            aoMudar={(v) => setValoresItens((atual) => ({ ...atual, [i.id]: v }))}
                            aoConfirmar={() => salvarValorItem(i.id, i.valorUnitario)}
                          />
                        </div>
                      )}
                      {os.itensEditaveis && i.valorVariavel && Number(i.valorUnitario) === 0 && (
                        <p className="text-xs text-amber-200">Informe o valor deste item.</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      {os.itensEditaveis ? (
                        <Quantidade
                          valor={i.quantidade}
                          desabilitado={ocupado}
                          aoMudar={(n) => executar(() => api<OSDetalhe>(`/os/${id}/itens/${i.id}`, "PUT", { quantidade: n }))}
                        />
                      ) : (
                        <span className="text-sm text-suave">{i.quantidade}x</span>
                      )}
                      <span className="w-24 text-right font-semibold tabular-nums">{formatarMoeda(i.subtotal)}</span>
                      {os.itensEditaveis && (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => executar(() => api<OSDetalhe>(`/os/${id}/itens/${i.id}`, "DELETE"))}
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-suave hover:bg-perigo/10 hover:text-perigo"
                          aria-label={`Remover ${i.nome}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          {/* Atendimento */}
          <Secao titulo="Atendimento">
            <form onSubmit={salvarAtendimento} className="grid gap-4 sm:grid-cols-2">
              <fieldset disabled={os.finalizada} className="contents">
                <CampoSelecao
                  rotulo="Onde"
                  value={atendimento.tipoAtendimento}
                  onChange={(e) => setAtendimento({ ...atendimento, tipoAtendimento: e.target.value as TipoAtendimento })}
                >
                  <option value="oficina">Na oficina</option>
                  <option value="campo">Em campo (no cliente)</option>
                </CampoSelecao>
                <CampoSelecao
                  rotulo="Técnico responsável"
                  value={atendimento.tecnicoId}
                  onChange={(e) => setAtendimento({ ...atendimento, tecnicoId: e.target.value })}
                >
                  {/* Garante que o tecnico atual aparece mesmo se a lista ainda nao carregou */}
                  {!equipe.some((t) => t.id === os.tecnico.id) && <option value={os.tecnico.id}>{os.tecnico.nome}</option>}
                  {equipe.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </CampoSelecao>
                {atendimento.tipoAtendimento === "campo" ? (
                  <Campo
                    rotulo="Data e hora da visita"
                    type="datetime-local"
                    value={atendimento.dataVisita}
                    onChange={(e) => mudarDataVisita(e.target.value)}
                  />
                ) : (
                  <span className="hidden sm:block" />
                )}
                {atendimento.tipoAtendimento === "campo" && (
                  <Campo
                    rotulo="Endereço do atendimento *"
                    className="sm:col-span-2"
                    value={atendimento.enderecoAtendimento}
                    onChange={(e) => setAtendimento({ ...atendimento, enderecoAtendimento: e.target.value })}
                  />
                )}
                <AreaTexto
                  rotulo="Defeito relatado"
                  className="sm:col-span-2"
                  value={atendimento.defeitoRelatado}
                  onChange={(e) => setAtendimento({ ...atendimento, defeitoRelatado: e.target.value })}
                />
                <AreaTexto
                  rotulo="Diagnóstico técnico"
                  className="sm:col-span-2"
                  value={atendimento.diagnostico}
                  onChange={(e) => setAtendimento({ ...atendimento, diagnostico: e.target.value })}
                />
                <AreaTexto
                  rotulo="Serviço executado"
                  className="sm:col-span-2"
                  value={atendimento.servicoExecutado}
                  onChange={(e) => setAtendimento({ ...atendimento, servicoExecutado: e.target.value })}
                />
                <Campo
                  rotulo="Previsão de entrega"
                  type="date"
                  value={atendimento.previsaoEntrega}
                  onChange={(e) => setAtendimento({ ...atendimento, previsaoEntrega: e.target.value })}
                />
                <Campo
                  rotulo="Garantia (dias)"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={atendimento.garantiaDias}
                  onChange={(e) => setAtendimento({ ...atendimento, garantiaDias: e.target.value })}
                />
                <AreaTexto
                  rotulo="Observações"
                  rows={2}
                  className="sm:col-span-2"
                  value={atendimento.observacoes}
                  onChange={(e) => setAtendimento({ ...atendimento, observacoes: e.target.value })}
                />
              </fieldset>
              {fase === "aberta" && os.aceiteTecnicoEm && atendimento.tecnicoId !== String(os.tecnico.id) && (
                <p className="text-xs text-amber-200 sm:col-span-2">Trocar o técnico cancela o aceite do técnico atual: o novo técnico precisará assinar.</p>
              )}
              {!os.finalizada && (
                <div className="flex items-center justify-end gap-3 sm:col-span-2">
                  {atendimentoAlterado && <span className="text-sm text-amber-200">Alterações não salvas</span>}
                  <Botao type="submit" disabled={ocupado || !atendimentoAlterado}>
                    Salvar atendimento
                  </Botao>
                </div>
              )}
            </form>
          </Secao>
        </div>

        {/* Coluna lateral */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          {/* Valores */}
          <Secao titulo="Valores e pagamento">
            <form onSubmit={salvarPagamento} className="flex flex-col gap-3">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-suave">Itens</dt>
                  <dd className="tabular-nums">{formatarMoeda(os.valorItens)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-suave">Desconto</dt>
                  <dd className="tabular-nums">- {formatarMoeda(os.desconto)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-borda pt-2">
                  <dt className="font-semibold">Total</dt>
                  <dd className="text-2xl font-bold tabular-nums">{formatarMoeda(os.valorTotal)}</dd>
                </div>
              </dl>
              <fieldset disabled={fase === "cancelada"} className="flex flex-col gap-3">
                <Campo
                  rotulo="Desconto (R$)"
                  inputMode="decimal"
                  value={pagamento.desconto}
                  onChange={(e) => setPagamento({ ...pagamento, desconto: e.target.value })}
                  disabled={os.finalizada}
                />
                <CampoSelecao
                  rotulo="Forma de pagamento"
                  value={pagamento.formaPagamento}
                  onChange={(e) => setPagamento({ ...pagamento, formaPagamento: e.target.value as FormaPagamento | "" })}
                >
                  <option value="">Não definida</option>
                  {(Object.keys(ROTULO_PAGAMENTO) as FormaPagamento[]).map((f) => (
                    <option key={f} value={f}>
                      {ROTULO_PAGAMENTO[f]}
                    </option>
                  ))}
                </CampoSelecao>
                <div className="grid grid-cols-2 gap-2">
                  {(["pendente", "pago"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPagamento({ ...pagamento, pagamentoStatus: p })}
                      className={`min-h-11 rounded-xl border text-sm font-semibold ${
                        pagamento.pagamentoStatus === p
                          ? p === "pago"
                            ? "border-sucesso bg-sucesso/15 text-sucesso"
                            : "border-orange-400 bg-orange-400/15 text-orange-300"
                          : "border-borda text-suave"
                      }`}
                    >
                      {p === "pago" ? "Pago" : "A receber"}
                    </button>
                  ))}
                </div>
                {os.dataPagamento && <p className="text-xs text-suave">Pago em {formatarDataHora(os.dataPagamento)}</p>}
                {fase !== "cancelada" && (
                  <>
                    {pagamentoAlterado && <span className="text-center text-sm text-amber-200">Alterações não salvas</span>}
                    <Botao type="submit" variante={pagamentoAlterado ? "primario" : "secundario"} disabled={ocupado || !pagamentoAlterado}>
                      Salvar valores
                    </Botao>
                  </>
                )}
              </fieldset>
            </form>
          </Secao>

          {/* Cliente */}
          <Secao titulo="Cliente e responsáveis">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info rotulo="Cliente">
                <Link to={`/clientes/${os.cliente.id}`} className="text-primaria">
                  {os.cliente.nome}
                </Link>
              </Info>
              <Info rotulo="Telefone">
                {os.cliente.telefone && (
                  <a href={`tel:${os.cliente.telefone}`} className="text-primaria">
                    {os.cliente.telefone}
                  </a>
                )}
              </Info>
              <Info rotulo="CPF/CNPJ">{formatarCpfCnpj(os.cliente.cpfCnpj)}</Info>
              {m && (
                <Info rotulo="Máquina">
                  {maquina} · {ROTULO_TIPO_EQUIPAMENTO[m.tipo]}
                  {m.numeroSerie ? ` · ${m.numeroSerie}` : ""}
                </Info>
              )}
              <Info rotulo="Atendimento">{ROTULO_ATENDIMENTO[os.tipoAtendimento]}</Info>
              <Info rotulo="Técnico">{os.tecnico.nome}</Info>
              <Info rotulo="Aberta por">{os.vendedor.nome}</Info>
              <Info rotulo="Abertura">{formatarData(os.dataAbertura)}</Info>
              <Info rotulo="Previsão">{formatarDataSimples(os.previsaoEntrega)}</Info>
              {os.dataConclusao && <Info rotulo="Conclusão">{formatarData(os.dataConclusao)}</Info>}
              {os.dataEntrega && <Info rotulo="Entrega">{formatarData(os.dataEntrega)}</Info>}
            </dl>
          </Secao>

          {/* Avisos */}
          <Secao titulo="Avisos ao cliente">
            <HistoricoAvisos avisos={os.avisos} />
          </Secao>
        </div>
      </div>

    </div>
  );
}
