import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { formatarMoeda, paraCampoValor, paraNumero, ROTULO_PAGAMENTO, ROTULO_TIPO_ITEM } from "../formatar";
import type { Cliente, FormaPagamento, Item, PagamentoStatus, VendaDetalhe } from "../types";
import { Quantidade, SeletorCliente, SeletorItem } from "../components/Seletores";
import { Icone } from "../components/Icones";
import { AreaTexto, Aviso, Botao, CabecalhoPagina, Campo, CampoValorLinha, Cartao, Secao } from "../components/ui";

// "valor" so e usado nos itens de valor variavel (digitado na hora)
type Linha = { item: Item; quantidade: number; valor: string };

const precoDaLinha = (l: Linha) => (l.item.valorVariavel ? paraNumero(l.valor) : Number(l.item.valorUnitario));

export default function NovaVenda() {
  const navegar = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [escolhendoCliente, setEscolhendoCliente] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [escolhendoItem, setEscolhendoItem] = useState(true);
  const [desconto, setDesconto] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [situacao, setSituacao] = useState<PagamentoStatus>("pago");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const subtotal = useMemo(() => linhas.reduce((s, l) => s + l.quantidade * precoDaLinha(l), 0), [linhas]);
  const valorDesconto = Number(desconto.replace(",", ".")) || 0;
  const total = Math.max(subtotal - valorDesconto, 0);

  function adicionar(item: Item) {
    // Venda de balcao: mao de obra so em OS
    if (item.tipo === "mao_de_obra") {
      setErro("Mão de obra é serviço: registre em uma OS. Na venda entram peças e máquinas.");
      return;
    }
    setErro("");
    setLinhas((atual) => {
      const existe = atual.find((l) => l.item.id === item.id);
      if (existe) return atual.map((l) => (l === existe ? { ...l, quantidade: l.quantidade + 1 } : l));
      return [...atual, { item, quantidade: 1, valor: Number(item.valorUnitario) ? paraCampoValor(item.valorUnitario) : "" }];
    });
  }

  async function registrar(e?: FormEvent) {
    e?.preventDefault();
    setErro("");
    if (linhas.length === 0) return setErro("Adicione pelo menos um item.");
    setEnviando(true);
    try {
      const venda = await api<VendaDetalhe>("/vendas", "POST", {
        clienteId: cliente?.id ?? null,
        itens: linhas.map((l) => ({
          itemId: l.item.id,
          quantidade: l.quantidade,
          ...(l.item.valorVariavel ? { valorUnitario: paraNumero(l.valor) } : {}),
        })),
        desconto: desconto || "0",
        formaPagamento: forma,
        pagamentoStatus: situacao,
        observacoes,
      });
      navegar(`/vendas/${venda.id}`, { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  const botao = (
    <Botao type="submit" form="form-venda" disabled={enviando} className="w-full">
      {enviando ? "Registrando..." : "Registrar venda"}
    </Botao>
  );

  return (
    <div>
      <CabecalhoPagina titulo="Nova venda" subtitulo="Peças e máquinas no balcão" voltarPara="/vendas" voltarRotulo="Vendas" />

      <div className="grid gap-4 md:grid-cols-[1fr_320px] md:items-start">
        <form id="form-venda" onSubmit={registrar} className="flex min-w-0 flex-col gap-4">
          <Secao
            titulo="Produtos"
            acao={
              !escolhendoItem && (
                <Botao variante="secundario" pequeno onClick={() => setEscolhendoItem(true)}>
                  <Icone.mais_sinal tamanho={16} /> Adicionar
                </Botao>
              )
            }
          >
            {escolhendoItem && (
              <div className="mb-3">
                <SeletorItem aoEscolher={adicionar} />
                {linhas.length > 0 && (
                  <button type="button" className="mt-2 text-sm text-suave" onClick={() => setEscolhendoItem(false)}>
                    Fechar busca
                  </button>
                )}
              </div>
            )}
            {linhas.length > 0 && (
              <ul className="flex flex-col divide-y divide-borda">
                {linhas.map((l) => (
                  <li key={l.item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0 sm:flex-1">
                      <p className="font-medium sm:truncate">{l.item.nome}</p>
                      <p className="text-xs text-suave">
                        {ROTULO_TIPO_ITEM[l.item.tipo]} ·{" "}
                        {l.item.valorVariavel ? "valor variável" : `${formatarMoeda(l.item.valorUnitario)} cada`}
                      </p>
                      {l.item.valorVariavel && (
                        <div className="mt-2 w-fit">
                          <CampoValorLinha
                            rotulo={`Valor de ${l.item.nome}`}
                            valor={l.valor}
                            aoMudar={(v) => setLinhas((a) => a.map((x) => (x.item.id === l.item.id ? { ...x, valor: v } : x)))}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <Quantidade
                        valor={l.quantidade}
                        aoMudar={(n) => setLinhas((a) => a.map((x) => (x.item.id === l.item.id ? { ...x, quantidade: n } : x)))}
                      />
                      <span className="w-24 text-right font-semibold tabular-nums">
                        {formatarMoeda(l.quantidade * precoDaLinha(l))}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLinhas((a) => a.filter((x) => x.item.id !== l.item.id))}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-suave hover:bg-perigo/10 hover:text-perigo"
                        aria-label={`Remover ${l.item.nome}`}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao titulo="Cliente">
            {cliente ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-superficie-2 px-3 py-2.5">
                <span className="min-w-0 truncate font-medium">{cliente.nome}</span>
                <button type="button" className="shrink-0 text-sm text-primaria" onClick={() => setCliente(null)}>
                  Remover
                </button>
              </div>
            ) : escolhendoCliente ? (
              <SeletorCliente
                aoEscolher={(c) => {
                  setCliente(c);
                  setEscolhendoCliente(false);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-suave">Consumidor final (venda sem cadastro)</p>
                <Botao variante="secundario" pequeno onClick={() => setEscolhendoCliente(true)}>
                  Identificar cliente
                </Botao>
              </div>
            )}
          </Secao>

          <Secao titulo="Pagamento">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="text-sm font-medium">Forma de pagamento</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(Object.keys(ROTULO_PAGAMENTO) as FormaPagamento[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setForma(f)}
                      className={`min-h-11 rounded-xl border px-2 text-sm font-medium ${
                        forma === f ? "border-primaria bg-primaria/15 text-primaria" : "border-borda text-suave"
                      }`}
                    >
                      {ROTULO_PAGAMENTO[f].replace("Cartão de ", "")}
                    </button>
                  ))}
                </div>
              </div>
              <Campo rotulo="Desconto (R$)" inputMode="decimal" placeholder="0,00" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
              <div>
                <span className="text-sm font-medium">Situação</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["pago", "pendente"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSituacao(p)}
                      className={`min-h-11 rounded-xl border text-sm font-semibold ${
                        situacao === p
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
              </div>
              <AreaTexto rotulo="Observações" rows={2} className="sm:col-span-2" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </Secao>

          {erro && <Aviso>{erro}</Aviso>}
        </form>

        <aside className="hidden md:sticky md:top-20 md:block lg:top-8">
          <Cartao className="flex flex-col gap-3 p-5">
            <h2 className="font-semibold">Resumo</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-suave">Subtotal</dt>
                <dd className="tabular-nums">{formatarMoeda(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-suave">Desconto</dt>
                <dd className="tabular-nums">- {formatarMoeda(valorDesconto)}</dd>
              </div>
            </dl>
            <div className="border-t border-borda pt-3">
              <p className="text-sm text-suave">Total</p>
              <p className="text-3xl font-bold tabular-nums">{formatarMoeda(total)}</p>
            </div>
            {botao}
          </Cartao>
        </aside>
      </div>

      <div className="h-20 md:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-borda bg-superficie/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div className="shrink-0">
            <p className="text-xs text-suave">Total</p>
            <p className="text-xl font-bold tabular-nums">{formatarMoeda(total)}</p>
          </div>
          {botao}
        </div>
      </div>
    </div>
  );
}
