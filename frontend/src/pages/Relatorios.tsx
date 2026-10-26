import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { api, mensagemDeErro } from "../api";
import { CORES_STATUS, formatarDataSimples, formatarMes, formatarMoeda, ROTULO_ATENDIMENTO, ROTULO_PAGAMENTO, ROTULO_TIPO_ITEM, dataLocalISO } from "../formatar";
import type { Relatorio } from "../types";
import { Icone } from "../components/Icones";
import { Aviso, Botao, CabecalhoPagina, Campo, Cartao, Carregando, Filtros, Indicador } from "../components/ui";

const COR_SERVICOS = "#5ab4ea";
const COR_VENDAS = "#a78bfa";
const PALETA = ["#5ab4ea", "#a78bfa", "#34d399", "#fbbf24", "#fb923c", "#f472b6", "#94a3b8"];

type Preset = "30d" | "3m" | "6m" | "12m" | "personalizado";

function intervalo(preset: Preset): { de: string; ate: string } {
  const hoje = new Date();
  const de = new Date(hoje);
  if (preset === "30d") de.setDate(de.getDate() - 30);
  if (preset === "3m") de.setMonth(de.getMonth() - 3);
  if (preset === "6m") de.setMonth(de.getMonth() - 6);
  if (preset === "12m") de.setMonth(de.getMonth() - 12);
  const iso = (d: Date) => dataLocalISO(d);
  return { de: iso(de), ate: iso(hoje) };
}

const moedaCurta = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${v.toLocaleString("pt-BR")}`;

// Estilo do tooltip dos graficos no tema escuro
const tooltip = {
  contentStyle: { background: "#15163a", border: "1px solid #2a2c5e", borderRadius: 12, color: "#f2f3fa" },
  itemStyle: { color: "#f2f3fa" },
  labelStyle: { color: "#a3a6c8" },
};

function Grafico({ titulo, children, refEl }: { titulo: string; children: ReactNode; refEl: (el: HTMLDivElement | null) => void }) {
  return (
    <div ref={refEl}>
      <Cartao className="h-full p-4 sm:p-5">
        <h2 className="mb-4 font-semibold">{titulo}</h2>
        {children}
      </Cartao>
    </div>
  );
}

export default function Relatorios() {
  const [preset, setPreset] = useState<Preset>("6m");
  const [periodo, setPeriodo] = useState(intervalo("6m"));
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState("");
  const [exportando, setExportando] = useState(false);
  const blocos = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setDados(null);
    api<Relatorio>(`/relatorios?de=${periodo.de}&ate=${periodo.ate}`)
      .then(setDados)
      .catch((err) => setErro(mensagemDeErro(err)));
  }, [periodo]);

  function mudarPreset(p: Preset) {
    setPreset(p);
    if (p !== "personalizado") setPeriodo(intervalo(p));
  }

  // PDF: cada bloco (indicadores e graficos) vira uma imagem no documento
  async function exportarPdf() {
    if (!dados) return;
    setExportando(true);
    try {
      const doc = new jsPDF();
      const largura = doc.internal.pageSize.getWidth();
      const alturaPagina = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(46, 42, 120);
      doc.text("Relatório gerencial - FlexServ / TecFlex", 14, 18);
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110, 110, 130);
      doc.text(
        `Período: ${formatarDataSimples(dados.periodo.de)} a ${formatarDataSimples(dados.periodo.ate)} · Gerado em ${new Date().toLocaleString("pt-BR")}`,
        14,
        24
      );
      let y = 30;
      for (const el of blocos.current) {
        if (!el) continue;
        const img = await toPng(el, { backgroundColor: "#0b0c22", pixelRatio: 2 });
        const props = doc.getImageProperties(img);
        const w = largura - 28;
        const h = (props.height * w) / props.width;
        if (y + h > alturaPagina - 12) {
          doc.addPage();
          y = 14;
        }
        doc.addImage(img, "PNG", 14, y, w, h);
        y += h + 5;
      }
      doc.save(`relatorio-flexserv-${dados.periodo.de}-a-${dados.periodo.ate}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  const r = dados?.resumo;
  blocos.current = [];
  const registrar = (el: HTMLDivElement | null) => {
    if (el && !blocos.current.includes(el)) blocos.current.push(el);
  };

  return (
    <div>
      <CabecalhoPagina
        titulo="Relatórios"
        subtitulo="Faturamento, serviços e vendas da assistência"
        acao={
          <Botao variante="secundario" onClick={exportarPdf} disabled={!dados || exportando}>
            <Icone.pdf tamanho={18} /> {exportando ? "Gerando PDF..." : "Exportar PDF"}
          </Botao>
        }
      />

      <div className="mb-5 flex flex-col gap-3">
        <Filtros
          opcoes={[
            { valor: "30d", rotulo: "30 dias" },
            { valor: "3m", rotulo: "3 meses" },
            { valor: "6m", rotulo: "6 meses" },
            { valor: "12m", rotulo: "12 meses" },
            { valor: "personalizado", rotulo: "Personalizado" },
          ]}
          valor={preset}
          aoMudar={mudarPreset}
        />
        {preset === "personalizado" && (
          <div className="grid max-w-md grid-cols-2 gap-3">
            <Campo rotulo="De" type="date" value={periodo.de} onChange={(e) => e.target.value && setPeriodo({ ...periodo, de: e.target.value })} />
            <Campo rotulo="Até" type="date" value={periodo.ate} onChange={(e) => e.target.value && setPeriodo({ ...periodo, ate: e.target.value })} />
          </div>
        )}
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {!dados && !erro && <Carregando />}

      {dados && r && (
        <div className="flex flex-col gap-4">
          {/* Indicadores */}
          <div ref={registrar} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador destaque rotulo="Faturamento" valor={formatarMoeda(r.receitaTotal)} detalhe={`Serviços ${formatarMoeda(r.receitaServicos)} · Vendas ${formatarMoeda(r.receitaVendas)}`} />
            <Indicador rotulo="Lucro estimado" valor={formatarMoeda(r.lucro)} detalhe={`Custo das peças: ${formatarMoeda(r.custo)}`} />
            <Indicador rotulo="A receber" valor={formatarMoeda(r.aReceber)} detalhe="OS e vendas pendentes" />
            <Indicador rotulo="Ticket médio por OS" valor={formatarMoeda(r.ticketMedioOs)} detalhe={`${r.osFaturadas} OS concluídas`} />
            <Indicador rotulo="OS em aberto" valor={String(r.osEmAberto)} detalhe="Aguardando ou em execução" />
            <Indicador rotulo="Tempo médio" valor={`${Number(r.tempoMedioDias).toLocaleString("pt-BR")} dias`} detalhe="Da abertura à conclusão" />
            <Indicador rotulo="Vendas no balcão" valor={String(r.vendas)} detalhe={formatarMoeda(r.receitaVendas)} />
            <Indicador
              rotulo="Margem"
              valor={`${Number(r.receitaTotal) > 0 ? ((Number(r.lucro) / Number(r.receitaTotal)) * 100).toFixed(0) : 0}%`}
              detalhe="Lucro sobre o faturamento"
            />
          </div>

          <Grafico titulo="Faturamento por mês" refEl={registrar}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.porMes.map((m) => ({ mes: formatarMes(m.mes), Serviços: Number(m.servicos), Vendas: Number(m.vendas) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2c5e" vertical={false} />
                  <XAxis dataKey="mes" stroke="#a3a6c8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#a3a6c8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={moedaCurta} width={78} />
                  <Tooltip {...tooltip} formatter={(v) => formatarMoeda(Number(v))} cursor={{ fill: "#ffffff08" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Serviços" stackId="a" fill={COR_SERVICOS} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Vendas" stackId="a" fill={COR_VENDAS} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Grafico>

          <div className="grid gap-4 lg:grid-cols-2">
            <Grafico titulo="OS por status (abertas no período)" refEl={registrar}>
              <Rosca dados={dados.porStatus.filter((s) => s.quantidade > 0).map((s) => ({ nome: s.nome, valor: s.quantidade, cor: CORES_STATUS[s.cor].hex }))} />
            </Grafico>
            <Grafico titulo="Oficina x em campo" refEl={registrar}>
              <Rosca
                dados={dados.oficinaCampo.map((o, i) => ({ nome: ROTULO_ATENDIMENTO[o.tipo], valor: o.quantidade, cor: [COR_SERVICOS, "#34d399"][i % 2] }))}
              />
            </Grafico>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Grafico titulo="Peças, máquinas e serviços que mais faturaram" refEl={registrar}>
              {dados.topItens.length === 0 ? (
                <p className="text-sm text-suave">Sem dados no período.</p>
              ) : (
                <div style={{ height: Math.max(dados.topItens.length * 38, 120) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={dados.topItens.map((t) => ({ nome: t.nome, receita: Number(t.receita), tipo: ROTULO_TIPO_ITEM[t.tipo] }))} margin={{ left: 8 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="nome" width={150} stroke="#a3a6c8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip {...tooltip} formatter={(v) => formatarMoeda(Number(v))} cursor={{ fill: "#ffffff08" }} />
                      <Bar dataKey="receita" name="Faturamento" radius={[0, 6, 6, 0]}>
                        {dados.topItens.map((_, i) => (
                          <Cell key={i} fill={PALETA[i % PALETA.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Grafico>
            <Grafico titulo="Recebido por forma de pagamento" refEl={registrar}>
              <Rosca
                moeda
                dados={dados.formasPagamento.map((f, i) => ({ nome: ROTULO_PAGAMENTO[f.forma] ?? f.forma, valor: Number(f.total), cor: PALETA[i % PALETA.length] }))}
              />
            </Grafico>
          </div>

          <Grafico titulo="Desempenho por vendedor" refEl={registrar}>
            <table className="w-full text-sm">
              <thead className="text-suave">
                <tr className="border-b border-borda">
                  <th className="py-2 text-left font-medium">Vendedor</th>
                  <th className="py-2 text-right font-medium">OS abertas</th>
                  <th className="py-2 text-right font-medium">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {dados.porVendedor.map((v) => (
                  <tr key={v.nome} className="border-b border-borda last:border-0">
                    <td className="py-2.5">{v.nome}</td>
                    <td className="py-2.5 text-right tabular-nums">{v.osAbertas}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatarMoeda(v.receita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Grafico>

          <p className="text-xs text-suave">
            Faturamento de serviços considera OS concluídas ou entregues (pela data de conclusão). Vendas canceladas não
            entram. Lucro = faturamento menos o custo das peças e máquinas cadastrado em cada item.
          </p>
        </div>
      )}
    </div>
  );
}

// Grafico de rosca com legenda ao lado
function Rosca({ dados, moeda = false }: { dados: { nome: string; valor: number; cor: string }[]; moeda?: boolean }) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (total === 0) return <p className="text-sm text-suave">Sem dados no período.</p>;
  const fmt = (v: number) => (moeda ? formatarMoeda(v) : String(v));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
              {dados.map((d) => (
                <Cell key={d.nome} fill={d.cor} />
              ))}
            </Pie>
            <Tooltip {...tooltip} formatter={(v) => fmt(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold">{moeda ? moedaCurta(total) : total}</span>
          <span className="text-xs text-suave">total</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {dados.map((d) => (
          <li key={d.nome} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.cor }} />
            <span className="flex-1 truncate">{d.nome}</span>
            <span className="tabular-nums text-suave">{fmt(d.valor)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-suave">{Math.round((d.valor / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
