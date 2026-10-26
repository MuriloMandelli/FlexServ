import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { useAuth } from "../auth";
import { dataHoraParaISO, formatarMoeda, paraCampoValor, paraNumero, ROTULO_TIPO_ITEM } from "../formatar";
import type { Cliente, Item, MembroEquipe, OSDetalhe, TipoAtendimento } from "../types";
import { Icone } from "../components/Icones";
import { Quantidade, SeletorCliente, SeletorItem } from "../components/Seletores";
import { AreaTexto, Aviso, Botao, CabecalhoPagina, Campo, CampoSelecao, CampoValorLinha, Cartao } from "../components/ui";

// "valor" so e usado nos itens de valor variavel (digitado na hora)
type Linha = { item: Item; quantidade: number; valor: string };

const precoDaLinha = (l: Linha) => (l.item.valorVariavel ? paraNumero(l.valor) : Number(l.item.valorUnitario));

export default function NovaOS() {
  const navegar = useNavigate();
  const { usuario } = useAuth();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  // Tecnico responsavel: por padrao quem esta abrindo, mas pode ser outro
  // (ex.: o atendimento abre a OS e escolhe o tecnico)
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [tecnicoId, setTecnicoId] = useState(String(usuario?.id ?? ""));

  // Oficina (maquina vem ate a loja) ou campo (tecnico vai ate o cliente)
  const [tipo, setTipo] = useState<TipoAtendimento>("oficina");
  const [endereco, setEndereco] = useState("");
  const [dataVisita, setDataVisita] = useState("");

  const [defeito, setDefeito] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [previsao, setPrevisao] = useState("");
  // A previsao herda a data da visita enquanto a pessoa nao mudar ela a mao
  const [previsaoManual, setPrevisaoManual] = useState(false);

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [escolhendoItem, setEscolhendoItem] = useState(false);

  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api<MembroEquipe[]>("/equipe").then(setEquipe).catch(() => setEquipe([]));
  }, []);

  // Sugere o endereco do cadastro do cliente para o atendimento em campo
  useEffect(() => {
    if (cliente) setEndereco([cliente.endereco, cliente.cidade].filter(Boolean).join(", "));
  }, [cliente]);

  function mudarDataVisita(valor: string) {
    setDataVisita(valor);
    if (!previsaoManual) setPrevisao(valor.slice(0, 10));
  }

  // Total so para mostrar na tela. O valor oficial e calculado pelo back-end.
  const total = useMemo(() => linhas.reduce((soma, l) => soma + l.quantidade * precoDaLinha(l), 0), [linhas]);
  const tecnico = equipe.find((t) => String(t.id) === tecnicoId);

  function adicionarItem(item: Item) {
    setLinhas((atual) => {
      const existente = atual.find((l) => l.item.id === item.id);
      if (existente) return atual.map((l) => (l === existente ? { ...l, quantidade: l.quantidade + 1 } : l));
      // Valor variavel: vem com o valor sugerido do cadastro (se houver) para ajustar
      return [...atual, { item, quantidade: 1, valor: Number(item.valorUnitario) ? paraCampoValor(item.valorUnitario) : "" }];
    });
    setEscolhendoItem(false);
  }

  function mudarQuantidade(itemId: number, quantidade: number) {
    setLinhas((atual) => atual.map((l) => (l.item.id === itemId ? { ...l, quantidade } : l)));
  }

  function mudarValor(itemId: number, valor: string) {
    setLinhas((atual) => atual.map((l) => (l.item.id === itemId ? { ...l, valor } : l)));
  }

  function removerItem(itemId: number) {
    setLinhas((atual) => atual.filter((l) => l.item.id !== itemId));
  }

  async function abrirOS(e?: FormEvent) {
    e?.preventDefault();
    setErro("");
    if (!cliente) return setErro("Selecione o cliente.");
    if (tipo === "campo" && !endereco.trim()) return setErro("Informe o endereço do atendimento em campo.");

    setEnviando(true);
    try {
      const os = await api<OSDetalhe>("/os", "POST", {
        clienteId: cliente.id,
        tecnicoId: tecnicoId ? Number(tecnicoId) : null,
        tipoAtendimento: tipo,
        enderecoAtendimento: tipo === "campo" ? endereco : null,
        dataVisita: tipo === "campo" ? dataHoraParaISO(dataVisita) : null,
        defeitoRelatado: defeito,
        observacoes,
        previsaoEntrega: previsao,
        itens: linhas.map((l) => ({
          itemId: l.item.id,
          quantidade: l.quantidade,
          ...(l.item.valorVariavel ? { valorUnitario: paraNumero(l.valor) } : {}),
        })),
      });
      navegar(`/os/${os.id}`, { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  const botaoAbrir = (
    <Botao type="submit" form="form-nova-os" disabled={enviando} className="w-full">
      {enviando ? "Abrindo..." : "Abrir OS"}
    </Botao>
  );

  return (
    <div>
      <CabecalhoPagina titulo="Nova OS" subtitulo="Ordem de serviço de manutenção" voltarPara="/os" voltarRotulo="Ordens de serviço" />

      <div className="grid gap-4 md:grid-cols-[1fr_300px] md:items-start">
        <form id="form-nova-os" onSubmit={abrirOS} className="flex min-w-0 flex-col gap-4">
          {/* 1. Cliente */}
          <Cartao className="p-4 sm:p-5">
            <h2 className="mb-3 font-semibold">Cliente</h2>
            {cliente ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-superficie-2 px-3 py-2.5">
                <span className="min-w-0 truncate font-medium">{cliente.nome}</span>
                <button type="button" className="shrink-0 text-sm text-primaria" onClick={() => setCliente(null)}>
                  Trocar
                </button>
              </div>
            ) : (
              <SeletorCliente aoEscolher={setCliente} />
            )}
          </Cartao>

          {/* 3. Atendimento */}
          <Cartao className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div className="sm:col-span-2">
              <span className="text-sm font-medium">Onde será o atendimento?</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["oficina", "Na oficina", "O cliente traz até a TecFlex"],
                    ["campo", "Em campo", "O técnico vai até o cliente"],
                  ] as const
                ).map(([valor, titulo, detalhe]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setTipo(valor)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      tipo === valor ? "border-primaria bg-primaria/10" : "border-borda hover:bg-superficie-2"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {valor === "campo" ? <Icone.campo tamanho={18} /> : <Icone.ferramenta tamanho={18} />}
                      {titulo}
                    </span>
                    <span className="mt-0.5 block text-xs text-suave">{detalhe}</span>
                  </button>
                ))}
              </div>
            </div>
            {tipo === "campo" && (
              <>
                <Campo
                  rotulo="Endereço do atendimento *"
                  className="sm:col-span-2"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                />
                <Campo
                  rotulo="Data e hora da visita"
                  type="datetime-local"
                  value={dataVisita}
                  onChange={(e) => mudarDataVisita(e.target.value)}
                />
              </>
            )}
            <AreaTexto
              rotulo="Defeito relatado pelo cliente"
              className="sm:col-span-2"
              value={defeito}
              onChange={(e) => setDefeito(e.target.value)}
              placeholder="Ex.: duas retas pulando ponto e overloque fazendo barulho"
            />
            <CampoSelecao rotulo="Técnico responsável" value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
              {equipe.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                  {t.id === usuario?.id ? " (eu)" : ""}
                </option>
              ))}
            </CampoSelecao>
            <Campo
              rotulo="Previsão de entrega"
              type="date"
              value={previsao}
              onChange={(e) => {
                setPrevisao(e.target.value);
                setPrevisaoManual(true);
              }}
              dica={tipo === "campo" && !previsaoManual && previsao ? "Mesma data da visita (pode alterar)." : undefined}
            />
            <AreaTexto
              rotulo="Observações"
              rows={2}
              className="sm:col-span-2"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: veio com pedal e fonte"
            />
          </Cartao>

          {/* 4. Itens */}
          <Cartao className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Itens da OS</h2>
              {!escolhendoItem && (
                <Botao type="button" variante="secundario" onClick={() => setEscolhendoItem(true)}>
                  + Adicionar item
                </Botao>
              )}
            </div>

            {escolhendoItem && (
              <div className="mb-3">
                <SeletorItem aoEscolher={adicionarItem} />
                <button type="button" className="mt-2 text-sm text-suave" onClick={() => setEscolhendoItem(false)}>
                  Fechar busca
                </button>
              </div>
            )}

            {linhas.length === 0 ? (
              <p className="rounded-xl border border-dashed border-borda px-3 py-5 text-center text-sm text-suave">
                Nenhum item ainda. Use <b>Adicionar item</b> para escolher peças e mão de obra.
                <br />
                Os itens também podem ser lançados depois do diagnóstico.
              </p>
            ) : (
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
                          <CampoValorLinha rotulo={`Valor de ${l.item.nome}`} valor={l.valor} aoMudar={(v) => mudarValor(l.item.id, v)} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <Quantidade valor={l.quantidade} aoMudar={(n) => mudarQuantidade(l.item.id, n)} />
                      <span className="w-24 text-right font-semibold tabular-nums">{formatarMoeda(l.quantidade * precoDaLinha(l))}</span>
                      <button
                        type="button"
                        onClick={() => removerItem(l.item.id)}
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
          </Cartao>

          {erro && <Aviso>{erro}</Aviso>}
        </form>

        {/* Resumo: coluna fixa no computador */}
        <aside className="hidden md:sticky md:top-20 md:block lg:top-8">
          <Cartao className="flex flex-col gap-3 p-5">
            <h2 className="font-semibold">Resumo</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-suave">Cliente</dt>
                <dd className="truncate text-right">{cliente?.nome ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-suave">Técnico</dt>
                <dd className="truncate text-right">{tecnico?.nome ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-suave">Itens</dt>
                <dd>{linhas.reduce((s, l) => s + l.quantidade, 0)}</dd>
              </div>
            </dl>
            <div className="border-t border-borda pt-3">
              <p className="text-sm text-suave">Valor total</p>
              <p className="text-3xl font-bold tabular-nums">{formatarMoeda(total)}</p>
            </div>
            {botaoAbrir}
          </Cartao>
        </aside>
      </div>

      {/* Celular: total e botao sempre visiveis, logo acima da barra de navegacao */}
      <div className="h-20 md:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-borda bg-superficie/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div className="shrink-0">
            <p className="text-xs text-suave">Valor total</p>
            <p className="text-xl font-bold tabular-nums">{formatarMoeda(total)}</p>
          </div>
          {botaoAbrir}
        </div>
      </div>
    </div>
  );
}
