import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { formatarCpfCnpj, formatarDataHora, formatarMoeda, ROTULO_PAGAMENTO, ROTULO_TIPO_ITEM } from "../formatar";
import type { FormaPagamento, VendaDetalhe } from "../types";
import { abrirParaImprimir, compartilharPdf, gerarPdfVenda } from "../pdf";
import { SeloPagamento, SeloStatus } from "../components/StatusOS";
import { BotaoWhatsApp, HistoricoAvisos } from "../components/WhatsApp";
import { Icone } from "../components/Icones";
import { Aviso, Botao, CabecalhoPagina, CampoSelecao, Carregando, Secao } from "../components/ui";

export default function DetalheVenda() {
  const { id } = useParams();
  const [venda, setVenda] = useState<VendaDetalhe | null>(null);
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  function carregar(v: VendaDetalhe) {
    setVenda(v);
    setForma(v.formaPagamento ?? "");
  }

  useEffect(() => {
    api<VendaDetalhe>(`/vendas/${id}`)
      .then(carregar)
      .catch((err) => setErro(mensagemDeErro(err)));
  }, [id]);

  async function executar(acao: () => Promise<VendaDetalhe>, sucesso: string) {
    setErro("");
    setMensagem("");
    setOcupado(true);
    try {
      carregar(await acao());
      setMensagem(sucesso);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setOcupado(false);
    }
  }

  if (!venda) {
    return (
      <div>
        <CabecalhoPagina titulo="Venda" voltarPara="/vendas" voltarRotulo="Vendas" />
        {erro ? <Aviso>{erro}</Aviso> : <Carregando />}
      </div>
    );
  }

  const cancelada = venda.status === "cancelada";
  const nome = venda.cliente?.nome.split(" ")[0] ?? "";

  async function pdf(acao: "imprimir" | "compartilhar") {
    const doc = await gerarPdfVenda(venda!);
    if (acao === "imprimir") abrirParaImprimir(doc);
    else await compartilharPdf(doc, `Venda-${venda!.id}-TecFlex`, `Recibo da venda #${venda!.id} - TecFlex`);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina
        titulo={`Venda #${venda.id}`}
        subtitulo={`${venda.cliente?.nome ?? "Consumidor final"} · ${formatarDataHora(venda.data)}`}
        voltarPara="/vendas"
        voltarRotulo="Vendas"
        acao={
          <>
            <Botao variante="secundario" pequeno onClick={() => pdf("imprimir")}>
              <Icone.imprimir tamanho={16} /> Imprimir
            </Botao>
            <Botao variante="secundario" pequeno onClick={() => pdf("compartilhar")}>
              <Icone.compartilhar tamanho={16} /> Recibo PDF
            </Botao>
            {venda.cliente && (
              <BotaoWhatsApp
                pequeno
                telefone={venda.cliente.telefone}
                modelos={[
                  { rotulo: "Agradecimento", texto: `Olá ${nome}! Obrigado pela compra na TecFlex. Venda #${venda.id}, total ${formatarMoeda(venda.valorTotal)}.` },
                  { rotulo: "Cobrança", texto: `Olá ${nome}! Lembrete da TecFlex: a venda #${venda.id} no valor de ${formatarMoeda(venda.valorTotal)} está em aberto.` },
                ]}
                aoConfirmar={(msg) => executar(() => api<VendaDetalhe>(`/vendas/${id}/avisos`, "POST", { mensagem: msg }), "Aviso registrado.")}
              />
            )}
          </>
        }
      />

      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
      {mensagem && <div className="mb-4"><Aviso tipo="sucesso">{mensagem}</Aviso></div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="flex flex-col gap-4">
          <Secao titulo="Itens" acao={cancelada ? <SeloStatus nome="Cancelada" cor="vermelho" /> : <SeloPagamento status={venda.pagamentoStatus} />}>
            <ul className="flex flex-col divide-y divide-borda">
              {venda.itens.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{i.nome}</p>
                    <p className="text-xs text-suave">
                      {ROTULO_TIPO_ITEM[i.tipo]} · {i.quantidade} x {formatarMoeda(i.valorUnitario)}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatarMoeda(i.subtotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-borda pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-suave">Subtotal</dt>
                <dd className="tabular-nums">{formatarMoeda(venda.valorItens)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-suave">Desconto</dt>
                <dd className="tabular-nums">- {formatarMoeda(venda.desconto)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="font-semibold">Total</dt>
                <dd className="text-2xl font-bold tabular-nums">{formatarMoeda(venda.valorTotal)}</dd>
              </div>
            </dl>
          </Secao>
          {venda.observacoes && (
            <Secao titulo="Observações">
              <p className="whitespace-pre-line text-sm">{venda.observacoes}</p>
            </Secao>
          )}
          {venda.cliente && (
            <Secao titulo="Avisos ao cliente">
              <HistoricoAvisos avisos={venda.avisos} />
            </Secao>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Secao titulo="Dados da venda">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-suave">Cliente</dt>
                <dd>
                  {venda.cliente ? (
                    <Link to={`/clientes/${venda.cliente.id}`} className="text-primaria">
                      {venda.cliente.nome}
                    </Link>
                  ) : (
                    "Consumidor final"
                  )}
                  {venda.cliente?.cpfCnpj && <span className="text-suave"> · {formatarCpfCnpj(venda.cliente.cpfCnpj)}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-suave">Vendedor</dt>
                <dd>{venda.vendedor.nome}</dd>
              </div>
              {venda.dataPagamento && (
                <div>
                  <dt className="text-xs text-suave">Pago em</dt>
                  <dd>{formatarDataHora(venda.dataPagamento)}</dd>
                </div>
              )}
            </dl>
          </Secao>

          {!cancelada && (
            <Secao titulo="Pagamento">
              <div className="flex flex-col gap-3">
                <CampoSelecao rotulo="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
                  <option value="">Não definida</option>
                  {(Object.keys(ROTULO_PAGAMENTO) as FormaPagamento[]).map((f) => (
                    <option key={f} value={f}>
                      {ROTULO_PAGAMENTO[f]}
                    </option>
                  ))}
                </CampoSelecao>
                {venda.pagamentoStatus === "pendente" ? (
                  <Botao
                    disabled={ocupado}
                    onClick={() =>
                      executar(
                        () => api<VendaDetalhe>(`/vendas/${id}/pagamento`, "PUT", { formaPagamento: forma || null, pagamentoStatus: "pago" }),
                        "Pagamento registrado."
                      )
                    }
                  >
                    <Icone.check tamanho={18} /> Marcar como pago
                  </Botao>
                ) : (
                  <Botao
                    variante="secundario"
                    disabled={ocupado}
                    onClick={() =>
                      executar(
                        () => api<VendaDetalhe>(`/vendas/${id}/pagamento`, "PUT", { formaPagamento: forma || null, pagamentoStatus: "pendente" }),
                        "Venda voltou para 'a receber'."
                      )
                    }
                  >
                    Voltar para "a receber"
                  </Botao>
                )}
                <Botao
                  variante="perigo"
                  disabled={ocupado}
                  onClick={() => {
                    if (confirm(`Cancelar a venda #${venda.id}? Ela sai dos relatórios de faturamento.`)) {
                      executar(() => api<VendaDetalhe>(`/vendas/${id}/cancelar`, "PATCH"), "Venda cancelada.");
                    }
                  }}
                >
                  Cancelar venda
                </Botao>
              </div>
            </Secao>
          )}
        </div>
      </div>
    </div>
  );
}
