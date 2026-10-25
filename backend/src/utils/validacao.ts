import { z } from "zod";

// Texto opcional: "" ou so espacos vira null (campo vazio no formulario)
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

// Texto obrigatorio
export const textoObrigatorio = (campo: string, max: number) =>
  z
    .string({ required_error: `${campo} é obrigatório.` })
    .trim()
    .min(1, `${campo} é obrigatório.`)
    .max(max, `${campo}: máximo de ${max} caracteres.`);

// Mantem so os digitos ("123.456.789-00" -> "12345678900")
export const somenteDigitos = (v: string) => v.replace(/\D/g, "");

// Valor em reais: aceita "12,50", "12.50" ou 12.5. Guarda com 2 casas.
export const dinheiroSchema = (campo: string) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (v === "" ? 0 : Number(String(v).replace(",", "."))))
    .refine((v) => Number.isFinite(v) && v >= 0, { message: `${campo} inválido.` })
    .transform((v) => v.toFixed(2));

// Valor em reais opcional (vazio = nao informado)
export const dinheiroOpcional = (campo: string) =>
  z
    .union([z.number(), z.string()])
    .nullish()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), { message: `${campo} inválido.` })
    .transform((v) => (v === null ? null : v.toFixed(2)));

// Preco aplicado ao lancar um item: se o item tem valor variavel e veio um
// valor informado, usa ele; senao, sempre o preco do cadastro (o front nao
// consegue mudar o preco de itens de valor fixo)
export function precoAplicado(i: { valorVariavel: boolean; valorUnitario: string }, informado: string | null | undefined) {
  return i.valorVariavel && informado != null ? informado : i.valorUnitario;
}

export const FORMAS_PAGAMENTO = ["dinheiro", "pix", "debito", "credito", "boleto"] as const;

export const formaPagamentoSchema = z
  .enum(FORMAS_PAGAMENTO, { message: "Forma de pagamento inválida." })
  .nullish()
  .transform((v) => v ?? null);

export const pagamentoStatusSchema = z.enum(["pendente", "pago"], {
  message: "Situação do pagamento inválida.",
});
