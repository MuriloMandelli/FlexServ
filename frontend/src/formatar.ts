import type { CorStatus, Fase, FormaPagamento, TipoAtendimento, TipoItem } from "./types";

// Formatacao para exibir na tela. O banco guarda so os digitos.

export function formatarCpfCnpj(valor: string | null) {
  if (!valor) return "";
  if (valor.length === 11) return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (valor.length === 14) return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return valor;
}

export function formatarCep(valor: string | null) {
  if (!valor) return "";
  return valor.length === 8 ? valor.replace(/(\d{5})(\d{3})/, "$1-$2") : valor;
}

export function formatarMoeda(valor: string | number) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Data com horario vinda do banco (ISO)
export function formatarData(valor: string | null) {
  if (!valor) return "";
  return new Date(valor).toLocaleDateString("pt-BR");
}

export function formatarDataHora(valor: string | null) {
  if (!valor) return "";
  return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Data pura "2026-10-20" (sem fuso horario, para nao "voltar" um dia)
export function formatarDataSimples(valor: string | null) {
  if (!valor) return "";
  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// "2026-10" -> "out/26"
export function formatarMes(valor: string) {
  const [ano, mes] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(".", "");
}

export const ROTULO_TIPO_ITEM: Record<TipoItem, string> = {
  peca: "Peça",
  maquina: "Máquina",
  mao_de_obra: "Mão de obra",
};
export const ROTULO_TIPO_EQUIPAMENTO = { industrial: "Industrial", domestica: "Doméstica" } as const;
export const ROTULO_ATENDIMENTO: Record<TipoAtendimento, string> = { oficina: "Oficina", campo: "Em campo" };
export const ROTULO_PAGAMENTO: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  boleto: "Boleto",
};

export const ROTULO_FASE: Record<Fase, string> = {
  aberta: "Aberta (aguardando aprovação)",
  execucao: "Em execução",
  concluida: "Concluída",
  entregue: "Entregue (final)",
  cancelada: "Cancelada (final)",
};

// Cores dos status: classes do selo e cor "pura" (graficos e PDF)
export const CORES_STATUS: Record<CorStatus, { selo: string; hex: string; rotulo: string }> = {
  azul: { selo: "bg-sky-400/15 text-sky-300", hex: "#38bdf8", rotulo: "Azul" },
  amarelo: { selo: "bg-amber-400/15 text-amber-300", hex: "#fbbf24", rotulo: "Amarelo" },
  laranja: { selo: "bg-orange-400/15 text-orange-300", hex: "#fb923c", rotulo: "Laranja" },
  verde: { selo: "bg-emerald-400/15 text-emerald-300", hex: "#34d399", rotulo: "Verde" },
  cinza: { selo: "bg-slate-400/15 text-slate-300", hex: "#94a3b8", rotulo: "Cinza" },
  vermelho: { selo: "bg-rose-400/15 text-rose-300", hex: "#fb7185", rotulo: "Vermelho" },
  roxo: { selo: "bg-violet-400/15 text-violet-300", hex: "#a78bfa", rotulo: "Roxo" },
  rosa: { selo: "bg-pink-400/15 text-pink-300", hex: "#f472b6", rotulo: "Rosa" },
};

// Data de hoje (ou de "d") no formato "2026-10-15", no horario LOCAL.
// (toISOString usa o horario de Greenwich: a noite ja daria o dia seguinte)
// "1.234,50" ou "1234.50" -> 1234.5 (campo de valor digitado)
export function paraNumero(valor: string) {
  const texto = valor.trim();
  // Com virgula, os pontos sao separador de milhar
  const n = Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// 85.9 ou "85.90" -> "85,90" (para preencher campo de valor)
export function paraCampoValor(valor: string | number) {
  return Number(valor).toFixed(2).replace(".", ",");
}

// "2026-10-25T15:01" (campo datetime-local) -> ISO com fuso (o servidor na
// nuvem roda em UTC; sem o fuso, a hora seria gravada errada)
export function dataHoraParaISO(valor: string) {
  return valor ? new Date(valor).toISOString() : null;
}

export function dataLocalISO(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
