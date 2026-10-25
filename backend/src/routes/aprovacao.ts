import { Router } from "express";
import { z } from "zod";
import { asc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { cliente, item, servico, servicoItem, statusOs, vendedor } from "../db/schema";
import { dispositivoDaRequisicao, ipDaRequisicao, responderErro } from "../utils/http";
import { textoObrigatorio } from "../utils/validacao";
import { registrarAceite } from "../services/aprovacao";
import type { Papel } from "../services/aprovacao";

// Pagina PUBLICA de aprovacao da OS (sem login). Quem tem o link (enviado
// pelo WhatsApp) le o orcamento e os termos e toca em "Assinar".
// O token do link e aleatorio e so vale enquanto a OS aguarda aprovacao;
// se itens ou desconto mudarem, os links antigos deixam de funcionar.

const router = Router();
const tecnico = alias(vendedor, "tecnico");

const LINK_INVALIDO = "Este link não é mais válido. Peça um novo link à TecFlex.";

const aceiteSchema = z.object({
  nome: textoObrigatorio("Seu nome", 120),
  concordo: z.literal(true, { message: "É preciso concordar com os termos para assinar." }),
});

async function buscarPorToken(token: string) {
  // Token tem 48 caracteres hexadecimais; qualquer outra coisa nem consulta
  if (!/^[0-9a-f]{48}$/.test(token)) return null;

  const [os] = await db
    .select({
      id: servico.id,
      fase: statusOs.fase,
      tokenCliente: servico.tokenCliente,
      dataAbertura: servico.dataAbertura,
      tipoAtendimento: servico.tipoAtendimento,
      defeitoRelatado: servico.defeitoRelatado,
      previsaoEntrega: servico.previsaoEntrega,
      garantiaDias: servico.garantiaDias,
      valorItens: servico.valorItens,
      desconto: servico.desconto,
      valorTotal: servico.valorTotal,
      termos: servico.termosAprovacao,
      clienteNome: cliente.nome,
      tecnicoNome: tecnico.nome,
      aceiteClienteEm: servico.aceiteClienteEm,
      aceiteClienteNome: servico.aceiteClienteNome,
      aceiteTecnicoEm: servico.aceiteTecnicoEm,
      aceiteTecnicoNome: servico.aceiteTecnicoNome,
    })
    .from(servico)
    .innerJoin(statusOs, eq(servico.statusId, statusOs.id))
    .innerJoin(cliente, eq(servico.clienteId, cliente.id))
    .innerJoin(tecnico, eq(sql`coalesce(${servico.tecnicoId}, ${servico.vendedorId})`, tecnico.id))
    .where(or(eq(servico.tokenCliente, token), eq(servico.tokenTecnico, token)));
  if (!os) return null;

  const papel: Papel = os.tokenCliente === token ? "cliente" : "tecnico";
  return { ...os, papel };
}

// GET /publico/aprovacao/:token -> orcamento, termos e situacao do aceite
router.get("/publico/aprovacao/:token", async (req, res) => {
  try {
    const os = await buscarPorToken(req.params.token);
    if (!os) return res.status(404).json({ erro: LINK_INVALIDO });

    const itens = await db
      .select({
        nome: item.nome,
        quantidade: servicoItem.quantidade,
        valorUnitario: servicoItem.valorUnitario,
        subtotal: sql<string>`(${servicoItem.quantidade} * ${servicoItem.valorUnitario})::numeric(10,2)`,
      })
      .from(servicoItem)
      .innerJoin(item, eq(servicoItem.itemId, item.id))
      .where(eq(servicoItem.servicoId, os.id))
      .orderBy(asc(servicoItem.id));

    const aceite =
      os.papel === "cliente"
        ? os.aceiteClienteEm && { em: os.aceiteClienteEm, nome: os.aceiteClienteNome }
        : os.aceiteTecnicoEm && { em: os.aceiteTecnicoEm, nome: os.aceiteTecnicoNome };

    // So o necessario: nada de CPF, telefone ou endereco na pagina publica
    res.json({
      papel: os.papel,
      os: {
        id: os.id,
        dataAbertura: os.dataAbertura,
        tipoAtendimento: os.tipoAtendimento,
        defeitoRelatado: os.defeitoRelatado,
        previsaoEntrega: os.previsaoEntrega,
        garantiaDias: os.garantiaDias,
        valorItens: os.valorItens,
        desconto: os.desconto,
        valorTotal: os.valorTotal,
        itens,
      },
      clienteNome: os.clienteNome,
      tecnicoNome: os.tecnicoNome,
      nomeSugerido: os.papel === "cliente" ? os.clienteNome : os.tecnicoNome,
      termos: os.termos,
      aceite: aceite || null,
      podeAssinar: !aceite && os.fase === "aberta",
    });
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /publico/aprovacao/:token { nome, concordo: true } -> registra o aceite
router.post("/publico/aprovacao/:token", async (req, res) => {
  try {
    const dados = aceiteSchema.parse(req.body);
    const os = await buscarPorToken(req.params.token);
    if (!os) return res.status(404).json({ erro: LINK_INVALIDO });

    const jaAceitou = os.papel === "cliente" ? os.aceiteClienteEm : os.aceiteTecnicoEm;
    if (jaAceitou) return res.status(409).json({ erro: "Esta OS já foi assinada por este link." });
    if (os.fase !== "aberta") return res.status(409).json({ erro: LINK_INVALIDO });

    await registrarAceite(db, os.id, os.papel, {
      nome: dados.nome,
      ip: ipDaRequisicao(req),
      dispositivo: dispositivoDaRequisicao(req),
      meio: "link",
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    responderErro(res, err);
  }
});

export default router;
