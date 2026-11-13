import { and, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

// Busca "inteligente" usada nas listas (clientes, OS, vendas, itens):
//   - ignora acentos e maiusculas: "joao" acha "JOÃO", "confeccoes" acha "CONFECÇÕES"
//   - palavras em qualquer ordem: "viana rosivane" acha "ROSIVANE VIANA"
//     (cada palavra digitada precisa aparecer em algum dos campos de texto)
//   - numeros (CPF/CNPJ, telefone) com ou sem pontuacao, a partir de 4 digitos,
//     para que um "3" solto nao traga todo mundo

const MIN_DIGITOS = 4;

const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN";

// Mesmo tratamento dos dois lados: no termo (JavaScript) e na coluna (banco)
export const normalizar = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const colunaNormalizada = (coluna: AnyColumn) =>
  sql`lower(translate(coalesce(${coluna}, ''), ${COM_ACENTO}, ${SEM_ACENTO}))`;

const colunaSoDigitos = (coluna: AnyColumn) => sql`regexp_replace(coalesce(${coluna}, ''), '\\D', '', 'g')`;

// % e _ sao curingas do LIKE: digitados pelo usuario, valem como texto
const escaparLike = (v: string) => v.replace(/[\\%_]/g, "\\$&");

export function filtroBusca(
  termo: string,
  campos: { texto: AnyColumn[]; digitos?: AnyColumn[] }
): SQL | undefined {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return undefined;

  const porTexto = and(
    ...palavras.map((p) => or(...campos.texto.map((c) => sql`${colunaNormalizada(c)} like ${`%${escaparLike(p)}%`}`)))
  );

  const digitos = termo.replace(/\D/g, "");
  const porNumero =
    campos.digitos && digitos.length >= MIN_DIGITOS
      ? or(...campos.digitos.map((c) => sql`${colunaSoDigitos(c)} like ${`%${digitos}%`}`))
      : undefined;

  return or(porTexto, porNumero);
}
