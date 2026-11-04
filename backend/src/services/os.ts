import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { servico, servicoItem } from "../db/schema";

// Regras de negocio da Ordem de Servico (OS).
// Os status sao configuraveis pela empresa, mas cada um pertence a uma
// FASE fixa. As regras abaixo olham sempre a fase, nunca o nome do status.

export type Fase = "aberta" | "execucao" | "concluida" | "entregue" | "cancelada";

export const FASES: Fase[] = ["aberta", "execucao", "concluida", "entregue", "cancelada"];

// Fases finais: a OS vira registro historico e nao muda mais
export function faseFinal(fase: Fase) {
  return fase === "entregue" || fase === "cancelada";
}

// O orcamento (itens e dados do atendimento) so pode ser mudado enquanto a OS
// esta aberta e ainda nao foi enviada para aprovacao. Depois do envio ele fica
// travado: e exatamente o que cliente e tecnico leram e assinaram.
// So "Valores e pagamento" (desconto, forma e situacao) continua editavel.
export function orcamentoEditavel(os: { fase: Fase; enviadaParaAprovacao: boolean }) {
  return os.fase === "aberta" && !os.enviadaParaAprovacao;
}

type SituacaoOS = { fase: Fase; aprovada: boolean; quantidadeItens: number };

// Diz se a OS pode ir para a nova fase. Devolve a mensagem de erro, ou null se pode.
export function validarTrocaDeFase(atual: SituacaoOS, nova: Fase): string | null {
  if (faseFinal(atual.fase)) return "OS entregue ou cancelada não pode mudar de status.";
  if (nova === "cancelada") return null;

  // O servico so comeca depois que o cliente aprova (assina) a OS
  if (nova !== "aberta" && !atual.aprovada) {
    return "A OS precisa ser aprovada (assinatura do cliente e do técnico) antes de iniciar.";
  }
  if ((nova === "concluida" || nova === "entregue") && atual.quantidadeItens === 0) {
    return "Adicione pelo menos um item antes de concluir a OS.";
  }
  if (nova === "entregue" && atual.fase !== "concluida") {
    return "Conclua a OS antes de marcar como entregue.";
  }
  return null;
}

// Tipo do "db" ou de uma transacao (os dois tem os mesmos metodos)
type Executor = Pick<typeof db, "update" | "select">;

// Recalcula os valores da OS:
//   valorItens = soma de quantidade x preco congelado de cada item
//   valorTotal = valorItens - desconto (nunca negativo)
// A conta e feita pelo proprio PostgreSQL (numeric), sem arredondamento
// de ponto flutuante do JavaScript.
export async function recalcularTotal(executor: Executor, servicoId: number) {
  const somaItens = sql`(
    select coalesce(sum(${servicoItem.quantidade} * ${servicoItem.valorUnitario}), 0)
    from ${servicoItem}
    where ${servicoItem.servicoId} = ${servicoId}
  )`;
  await executor
    .update(servico)
    .set({
      valorItens: somaItens,
      valorTotal: sql`greatest(${somaItens} - ${servico.desconto}, 0)`,
    })
    .where(eq(servico.id, servicoId));
}
