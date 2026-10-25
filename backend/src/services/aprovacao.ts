import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { configuracao, servico } from "../db/schema";

// Aprovacao eletronica da OS.
// Cliente e tecnico leem o orcamento e os termos e tocam em "Assinar".
// O cliente assina pelo link enviado no WhatsApp; o tecnico pelo link ou
// direto no sistema (logado). Cada aceite guarda nome, data/hora, IP e
// aparelho. A OS esta aprovada quando os dois aceitaram.

export type Papel = "cliente" | "tecnico";

export const CHAVE_TERMOS = "termos_aprovacao";

// Texto inicial. O gestor revisa e ajusta na tela "Termos de aprovacao".
export const TERMOS_PADRAO = `1. Orçamento: o serviço será executado conforme os itens e valores desta ordem de serviço. Qualquer peça ou serviço adicional será informado antes e só será feito com nova autorização.

2. Validade: este orçamento vale por 7 dias a partir do envio.

3. Garantia: cobre as peças substituídas e o serviço executado, pelo prazo indicado na OS, a partir da entrega. Não cobre mau uso, quedas, ligação em tensão incorreta ou conserto feito por terceiros.

4. Retirada: máquinas não retiradas em até 90 dias após o aviso de conclusão poderão ter taxa de armazenagem.

5. Pagamento: na retirada da máquina ou ao final do atendimento em campo, pelas formas aceitas pela TecFlex.`;

type Executor = Pick<typeof db, "select" | "update">;

export async function lerTermos(executor: Executor = db) {
  const [c] = await executor.select().from(configuracao).where(eq(configuracao.chave, CHAVE_TERMOS));
  return c?.valor ?? TERMOS_PADRAO;
}

// Token aleatorio e impossivel de adivinhar: e ele que da acesso ao link publico
export function gerarToken() {
  return crypto.randomBytes(24).toString("hex");
}

// Garante que a OS tem os links e a copia dos termos (o texto aceito fica
// congelado na OS: se o gestor mudar os termos depois, o aceite nao muda).
export async function prepararAprovacao(executor: Executor, os: {
  id: number;
  termosAprovacao: string | null;
  tokenCliente: string | null;
  tokenTecnico: string | null;
}) {
  const alteracoes: Partial<typeof servico.$inferInsert> = {};
  if (!os.termosAprovacao) alteracoes.termosAprovacao = await lerTermos(executor);
  if (!os.tokenCliente) alteracoes.tokenCliente = gerarToken();
  if (!os.tokenTecnico) alteracoes.tokenTecnico = gerarToken();
  if (Object.keys(alteracoes).length) {
    await executor.update(servico).set(alteracoes).where(eq(servico.id, os.id));
  }
}

export type DadosAceite = { nome: string; ip: string | null; dispositivo: string | null; meio?: "sistema" | "link" };

// Registra o aceite de um dos lados. Quando os dois aceitaram, aprova a OS.
export async function registrarAceite(executor: Executor, servicoId: number, papel: Papel, dados: DadosAceite) {
  const agora = new Date();
  const campos =
    papel === "cliente"
      ? {
          aceiteClienteEm: agora,
          aceiteClienteNome: dados.nome,
          aceiteClienteIp: dados.ip,
          aceiteClienteDispositivo: dados.dispositivo,
        }
      : {
          aceiteTecnicoEm: agora,
          aceiteTecnicoNome: dados.nome,
          aceiteTecnicoIp: dados.ip,
          aceiteTecnicoDispositivo: dados.dispositivo,
          aceiteTecnicoMeio: dados.meio ?? "link",
        };

  const [os] = await executor
    .update(servico)
    .set(campos)
    .where(eq(servico.id, servicoId))
    .returning({ aceiteClienteEm: servico.aceiteClienteEm, aceiteTecnicoEm: servico.aceiteTecnicoEm, aceiteClienteNome: servico.aceiteClienteNome });

  if (os?.aceiteClienteEm && os.aceiteTecnicoEm) {
    await executor
      .update(servico)
      .set({ aprovadoEm: agora, aprovadoPorNome: os.aceiteClienteNome })
      .where(eq(servico.id, servicoId));
  }
}
