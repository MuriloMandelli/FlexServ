import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatarCpfCnpj,
  formatarData,
  formatarDataHora,
  formatarDataSimples,
  formatarMoeda,
  ROTULO_ATENDIMENTO,
  ROTULO_PAGAMENTO,
  ROTULO_TIPO_EQUIPAMENTO,
  ROTULO_TIPO_ITEM,
} from "./formatar";
import type { OSDetalhe, VendaDetalhe } from "./types";

// Geracao de PDF no proprio navegador (sem servidor): relatorios de
// tabelas, a OS para imprimir/assinar e o recibo de venda.

const MARINHO: [number, number, number] = [46, 42, 120];
const CEU: [number, number, number] = [27, 156, 216];
const CINZA: [number, number, number] = [110, 110, 130];

// Logo carregada uma vez e reaproveitada
let logoCache: string | null = null;
async function logo() {
  if (logoCache) return logoCache;
  const blob = await (await fetch("/logo-tf.jpg")).blob();
  logoCache = await new Promise<string>((resolve) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.readAsDataURL(blob);
  });
  return logoCache;
}

async function cabecalho(doc: jsPDF, titulo: string, subtitulo?: string) {
  const largura = doc.internal.pageSize.getWidth();
  doc.addImage(await logo(), "JPEG", 14, 10, 14, 14);
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...MARINHO);
  doc.text("FlexServ", 31, 16);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
  doc.text("TecFlex · Aparelhos para máquinas de costura", 31, 21);

  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(20, 20, 30);
  doc.text(titulo, largura - 14, 16, { align: "right" });
  if (subtitulo) {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
    doc.text(subtitulo, largura - 14, 21, { align: "right" });
  }
  doc.setDrawColor(...CEU).setLineWidth(0.6).line(14, 27, largura - 14, 27);
}

function rodape(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} pelo FlexServ`, 14, altura - 8);
    doc.text(`Página ${i} de ${total}`, largura - 14, altura - 8, { align: "right" });
  }
}

// ---------- Relatorio de tabela (exportar listas) ----------

export type ColunaPdf = { titulo: string; direita?: boolean };

export async function exportarTabelaPdf(opcoes: {
  titulo: string;
  subtitulo?: string;
  colunas: ColunaPdf[];
  linhas: string[][];
  resumo?: string;
  nomeArquivo: string;
}) {
  const doc = new jsPDF({ orientation: opcoes.colunas.length > 5 ? "landscape" : "portrait", compress: true });
  await cabecalho(doc, opcoes.titulo, opcoes.subtitulo);

  autoTable(doc, {
    startY: 32,
    head: [opcoes.colunas.map((c) => c.titulo)],
    body: opcoes.linhas,
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    headStyles: { fillColor: MARINHO, textColor: 255 },
    alternateRowStyles: { fillColor: [244, 246, 252] },
    columnStyles: Object.fromEntries(
      opcoes.colunas.map((c, i) => [i, { halign: c.direita ? "right" : "left" }])
    ),
    margin: { left: 14, right: 14, bottom: 16 },
  });

  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(20, 20, 30);
  doc.text(opcoes.resumo ?? `${opcoes.linhas.length} registro(s)`, 14, y);

  rodape(doc);
  doc.save(`${opcoes.nomeArquivo}.pdf`);
}

// ---------- Blocos reaproveitados na OS e na venda ----------

function blocoTexto(doc: jsPDF, y: number, titulo: string, texto: string | null) {
  if (!texto) return y;
  const largura = doc.internal.pageSize.getWidth() - 28;
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...CINZA);
  doc.text(titulo.toUpperCase(), 14, y);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(20, 20, 30);
  const linhas = doc.splitTextToSize(texto, largura);
  doc.text(linhas, 14, y + 5);
  return y + 5 + linhas.length * 4.6 + 3;
}

function grade(doc: jsPDF, y: number, pares: [string, string][]) {
  autoTable(doc, {
    startY: y,
    body: pares.map(([r, v]) => [r, v]),
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: { top: 1.2, bottom: 1.2, left: 0, right: 2 } },
    columnStyles: { 0: { cellWidth: 42, textColor: CINZA, fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
}

function tabelaItens(doc: jsPDF, y: number, itens: OSDetalhe["itens"]) {
  autoTable(doc, {
    startY: y,
    head: [["Item", "Tipo", "Qtd", "Valor unit.", "Subtotal"]],
    body: itens.length
      ? itens.map((i) => [
          i.nome,
          ROTULO_TIPO_ITEM[i.tipo],
          String(i.quantidade),
          formatarMoeda(i.valorUnitario),
          formatarMoeda(i.subtotal),
        ])
      : [["Nenhum item lançado", "", "", "", ""]],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: MARINHO, textColor: 255 },
    columnStyles: { 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function totais(doc: jsPDF, y: number, itens: string, desconto: string, total: string) {
  const direita = doc.internal.pageSize.getWidth() - 14;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...CINZA);
  doc.text(`Itens: ${formatarMoeda(itens)}`, direita, y + 6, { align: "right" });
  if (Number(desconto) > 0) doc.text(`Desconto: - ${formatarMoeda(desconto)}`, direita, y + 11, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...MARINHO);
  const yTotal = y + (Number(desconto) > 0 ? 18 : 13);
  doc.text(`Total: ${formatarMoeda(total)}`, direita, yTotal, { align: "right" });
  return yTotal + 6;
}

function garantirEspaco(doc: jsPDF, y: number, necessario: number) {
  if (y + necessario > doc.internal.pageSize.getHeight() - 18) {
    doc.addPage();
    return 20;
  }
  return y;
}

// ---------- OS (imprimir, assinar, mandar ao cliente) ----------

export async function gerarPdfOS(os: OSDetalhe) {
  const doc = new jsPDF({ compress: true });
  await cabecalho(doc, `Ordem de Serviço #${os.id}`, `Aberta em ${formatarDataHora(os.dataAbertura)} · ${os.status.nome}`);

  const m = os.equipamento;
  let y = grade(doc, 32, [
    ["Cliente", os.cliente.nome],
    ...(os.cliente.cpfCnpj ? [["CPF/CNPJ", formatarCpfCnpj(os.cliente.cpfCnpj)] as [string, string]] : []),
    ...(os.cliente.telefone ? [["Telefone", os.cliente.telefone] as [string, string]] : []),
    ...(m
      ? [
          [
            "Máquina",
            `${m.marca} ${m.modelo} (${ROTULO_TIPO_EQUIPAMENTO[m.tipo]})${m.numeroSerie ? ` · Série ${m.numeroSerie}` : ""}`,
          ] as [string, string],
        ]
      : []),
    ["Atendimento", ROTULO_ATENDIMENTO[os.tipoAtendimento]],
    ...(os.tipoAtendimento === "campo"
      ? ([
          ["Local", os.enderecoAtendimento ?? "-"],
          ["Visita", os.dataVisita ? formatarDataHora(os.dataVisita) : "-"],
        ] as [string, string][])
      : []),
    ...(os.previsaoEntrega ? [["Previsão de entrega", formatarDataSimples(os.previsaoEntrega)] as [string, string]] : []),
    ["Técnico responsável", os.tecnico.nome],
  ]);

  y = blocoTexto(doc, y + 2, "Defeito relatado", os.defeitoRelatado);
  y = blocoTexto(doc, y, "Diagnóstico técnico", os.diagnostico);
  y = blocoTexto(doc, y, "Serviço executado", os.servicoExecutado);
  y = blocoTexto(doc, y, "Observações", os.observacoes);

  y = tabelaItens(doc, y + 1, os.itens);
  y = totais(doc, y, os.valorItens, os.desconto, os.valorTotal);

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
  const pagamento =
    os.pagamentoStatus === "pago"
      ? `Pago${os.formaPagamento ? ` (${ROTULO_PAGAMENTO[os.formaPagamento]})` : ""}${os.dataPagamento ? ` em ${formatarData(os.dataPagamento)}` : ""}`
      : `A receber${os.formaPagamento ? ` · ${ROTULO_PAGAMENTO[os.formaPagamento]}` : ""}`;
  doc.text(`Pagamento: ${pagamento}`, 14, y);
  if (os.garantiaDias) doc.text(`Garantia: ${os.garantiaDias} dias`, 14, y + 5);

  // Aprovacao eletronica: comprovante dos aceites (ou espaco para assinar no papel)
  y = garantirEspaco(doc, y + 14, 40);
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(20, 20, 30);
  doc.text("Aprovação do orçamento", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);

  const aceites: [string, string | null, string | null, string | null, string][] = [
    ["Cliente", os.aceiteClienteNome, os.aceiteClienteEm, os.aceiteClienteIp, "pelo link enviado ao cliente"],
    [
      "Técnico",
      os.aceiteTecnicoNome,
      os.aceiteTecnicoEm,
      os.aceiteTecnicoIp,
      os.aceiteTecnicoMeio === "sistema" ? "no sistema FlexServ" : "pelo link enviado ao técnico",
    ],
  ];
  if (os.aceiteClienteEm || os.aceiteTecnicoEm) {
    for (const [papel, nome, em, ip, meio] of aceites) {
      const linha = em
        ? `${papel}: ${nome} aceitou em ${formatarDataHora(em)}, ${meio}${ip ? ` (IP ${ip})` : ""}.`
        : `${papel}: aguardando aceite.`;
      doc.text(linha, 14, y);
      y += 5;
    }
    doc.text("Assinatura eletrônica: aceite registrado com nome, data, hora, IP e aparelho.", 14, y);
    y += 4;
  } else {
    // Sem aceite eletronico: linhas para assinar no papel
    const largura = doc.internal.pageSize.getWidth();
    const caixa = (largura - 28 - 10) / 2;
    [
      ["Cliente", os.cliente.nome],
      ["Técnico", os.tecnico.nome],
    ].forEach(([papel, nome], i) => {
      const x = 14 + i * (caixa + 10);
      doc.setDrawColor(150, 150, 165).setLineWidth(0.3).line(x, y + 16, x + caixa, y + 16);
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(20, 20, 30);
      doc.text(nome, x + caixa / 2, y + 21, { align: "center" });
      doc.setFontSize(7.5).setTextColor(...CINZA);
      doc.text(papel, x + caixa / 2, y + 25, { align: "center" });
    });
    y += 28;
  }

  // Termos aceitos (o texto congelado na OS no momento do envio)
  if (os.termosAprovacao) {
    y = garantirEspaco(doc, y + 6, 20);
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...CINZA);
    doc.text("TERMOS ACEITOS", 14, y);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(60, 60, 75);
    y += 5;
    // Linha a linha, quebrando de pagina quando precisar
    for (const linha of doc.splitTextToSize(os.termosAprovacao, doc.internal.pageSize.getWidth() - 28) as string[]) {
      y = garantirEspaco(doc, y, 4);
      doc.text(linha, 14, y);
      y += 3.8;
    }
  }

  rodape(doc);
  return doc;
}

// ---------- Venda (recibo) ----------

export async function gerarPdfVenda(v: VendaDetalhe) {
  const doc = new jsPDF({ compress: true });
  await cabecalho(doc, `Venda #${v.id}`, `${formatarDataHora(v.data)}${v.status === "cancelada" ? " · CANCELADA" : ""}`);
  let y = grade(doc, 32, [
    ["Cliente", v.cliente?.nome ?? "Consumidor final"],
    ...(v.cliente?.cpfCnpj ? [["CPF/CNPJ", formatarCpfCnpj(v.cliente.cpfCnpj)] as [string, string]] : []),
    ["Vendedor", v.vendedor.nome],
    [
      "Pagamento",
      `${v.formaPagamento ? ROTULO_PAGAMENTO[v.formaPagamento] : "-"} · ${v.pagamentoStatus === "pago" ? "Pago" : "A receber"}`,
    ],
  ]);
  y = blocoTexto(doc, y + 2, "Observações", v.observacoes);
  y = tabelaItens(doc, y + 1, v.itens);
  totais(doc, y, v.valorItens, v.desconto, v.valorTotal);
  rodape(doc);
  return doc;
}

// ---------- Salvar ou compartilhar ----------

// No celular abre o menu de compartilhar (WhatsApp, e-mail...). No
// computador, ou se o navegador nao suportar, so baixa o arquivo.
export async function compartilharPdf(doc: jsPDF, nomeArquivo: string, texto: string) {
  const arquivo = new File([doc.output("blob")], `${nomeArquivo}.pdf`, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nomeArquivo, text: texto });
      return "compartilhado";
    } catch {
      return "cancelado";
    }
  }
  doc.save(`${nomeArquivo}.pdf`);
  return "baixado";
}

// Abre o PDF em outra aba, pronto para imprimir
export function abrirParaImprimir(doc: jsPDF) {
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}
