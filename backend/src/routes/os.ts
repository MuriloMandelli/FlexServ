import { Router } from "express";
import { z } from "zod";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  avisoCliente,
  cliente,
  equipamento,
  item,
  servico,
  servicoItem,
  statusOs,
  vendedor,
} from "../db/schema";
import { autenticar } from "../middleware/auth";
import { lerId, responderErro } from "../utils/http";
import {
  assinaturaSchema,
  dinheiroSchema,
  formaPagamentoSchema,
  pagamentoStatusSchema,
  textoObrigatorio,
  textoOpcional,
} from "../utils/validacao";
import {
  faseFinal,
  FASES,
  invalidarAprovacao,
  itensEditaveis,
  recalcularTotal,
  validarTrocaDeFase,
} from "../services/os";
import type { Fase } from "../services/os";

// Ordens de Servico (tabela "servico")

const router = Router();
router.use("/os", autenticar);

const idSchema = (campo: string) =>
  z.coerce.number({ message: `${campo} é obrigatório.` }).int().positive(`${campo} é obrigatório.`);

const quantidadeSchema = z.coerce
  .number({ message: "Quantidade inválida." })
  .int("A quantidade deve ser um número inteiro.")
  .min(1, "A quantidade mínima é 1.")
  .max(9999, "Quantidade muito alta.");

// "2026-10-20" ou vazio
const dataOpcional = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Data inválida." });

// "2026-10-20T14:30" (campo datetime-local) ou vazio
const dataHoraOpcional = z
  .string()
  .nullish()
  .transform((v) => (v ? new Date(v) : null))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), { message: "Data da visita inválida." });

const garantiaSchema = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 3650), {
    message: "Garantia deve ser um número de dias.",
  });

const tipoAtendimentoSchema = z.enum(["oficina", "campo"], { message: "Tipo de atendimento inválido." });

// Em campo, o endereco onde o tecnico vai e obrigatorio
function exigirEnderecoEmCampo<T extends { tipoAtendimento: string; enderecoAtendimento: string | null }>(d: T) {
  return d.tipoAtendimento === "oficina" || !!d.enderecoAtendimento;
}
const msgEndereco = { message: "Informe o endereço do atendimento em campo.", path: ["enderecoAtendimento"] };

const atendimentoSchema = z
  .object({
    tipoAtendimento: tipoAtendimentoSchema,
    enderecoAtendimento: textoOpcional(255),
    dataVisita: dataHoraOpcional,
    defeitoRelatado: textoObrigatorio("Defeito relatado", 2000),
    diagnostico: textoOpcional(2000),
    servicoExecutado: textoOpcional(2000),
    observacoes: textoOpcional(2000),
    previsaoEntrega: dataOpcional,
    garantiaDias: garantiaSchema,
  })
  .refine(exigirEnderecoEmCampo, msgEndereco);

const abrirSchema = z
  .object({
    clienteId: idSchema("Cliente"),
    equipamentoId: idSchema("Máquina"),
    tipoAtendimento: tipoAtendimentoSchema.default("oficina"),
    enderecoAtendimento: textoOpcional(255),
    dataVisita: dataHoraOpcional,
    defeitoRelatado: textoObrigatorio("Defeito relatado", 2000),
    observacoes: textoOpcional(2000),
    previsaoEntrega: dataOpcional,
    garantiaDias: garantiaSchema,
    itens: z.array(z.object({ itemId: idSchema("Item"), quantidade: quantidadeSchema })).default([]),
  })
  .refine(exigirEnderecoEmCampo, msgEndereco);

const pagamentoSchema = z.object({
  desconto: dinheiroSchema("Desconto"),
  formaPagamento: formaPagamentoSchema,
  pagamentoStatus: pagamentoStatusSchema,
});

const aprovarSchema = z.object({
  aprovadoPorNome: textoObrigatorio("Nome de quem assina pelo cliente", 120),
  assinaturaCliente: assinaturaSchema("cliente"),
  assinaturaTecnico: assinaturaSchema("técnico"),
});

// Dados do status (nome, cor, fase) para juntar nas consultas
const colunasStatus = { id: statusOs.id, nome: statusOs.nome, cor: statusOs.cor, fase: statusOs.fase };

// Monta a OS completa: dados, cliente, maquina, vendedor, status, itens e avisos
async function carregarOS(id: number) {
  const [os] = await db
    .select({
      os: servico,
      status: colunasStatus,
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        cpfCnpj: cliente.cpfCnpj,
        endereco: cliente.endereco,
        cidade: cliente.cidade,
      },
      equipamento,
      vendedor: { id: vendedor.id, nome: vendedor.nome },
    })
    .from(servico)
    .innerJoin(statusOs, eq(servico.statusId, statusOs.id))
    .innerJoin(cliente, eq(servico.clienteId, cliente.id))
    .innerJoin(equipamento, eq(servico.equipamentoId, equipamento.id))
    .innerJoin(vendedor, eq(servico.vendedorId, vendedor.id))
    .where(eq(servico.id, id));

  if (!os) return null;

  const [itens, avisos] = await Promise.all([
    db
      .select({
        id: servicoItem.id,
        itemId: servicoItem.itemId,
        nome: item.nome,
        tipo: item.tipo,
        quantidade: servicoItem.quantidade,
        valorUnitario: servicoItem.valorUnitario,
        subtotal: sql<string>`(${servicoItem.quantidade} * ${servicoItem.valorUnitario})::numeric(10,2)`,
      })
      .from(servicoItem)
      .innerJoin(item, eq(servicoItem.itemId, item.id))
      .where(eq(servicoItem.servicoId, id))
      .orderBy(asc(servicoItem.id)),
    db
      .select({
        id: avisoCliente.id,
        mensagem: avisoCliente.mensagem,
        criadoEm: avisoCliente.criadoEm,
        vendedor: vendedor.nome,
      })
      .from(avisoCliente)
      .innerJoin(vendedor, eq(avisoCliente.vendedorId, vendedor.id))
      .where(eq(avisoCliente.servicoId, id))
      .orderBy(desc(avisoCliente.id)),
  ]);

  const fase = os.status.fase as Fase;
  return {
    ...os.os,
    status: os.status,
    cliente: os.cliente,
    equipamento: os.equipamento,
    vendedor: os.vendedor,
    itens,
    avisos,
    // Ajuda o front a saber o que mostrar
    aprovada: os.os.aprovadoEm !== null,
    itensEditaveis: itensEditaveis(fase),
    finalizada: faseFinal(fase),
  };
}

// GET /os -> lista resumida (mais recentes primeiro)
// Filtros: ?statusId= ?fase= ?tipo=oficina|campo ?pagamento=pendente|pago
//          ?busca= (nome do cliente ou numero da OS) ?clienteId= ?equipamentoId=
router.get("/os", async (req, res) => {
  try {
    const q = req.query;
    const fase = FASES.find((f) => f === q.fase);
    const statusId = lerId(String(q.statusId ?? ""));
    const tipo = q.tipo === "oficina" || q.tipo === "campo" ? q.tipo : null;
    const pagamento = q.pagamento === "pendente" || q.pagamento === "pago" ? q.pagamento : null;
    const busca = typeof q.busca === "string" ? q.busca.trim() : "";
    const numero = /^#?\d+$/.test(busca) ? Number(busca.replace("#", "")) : null;
    const clienteId = lerId(String(q.clienteId ?? ""));
    const equipamentoId = lerId(String(q.equipamentoId ?? ""));

    const lista = await db
      .select({
        id: servico.id,
        status: colunasStatus,
        tipoAtendimento: servico.tipoAtendimento,
        valorTotal: servico.valorTotal,
        pagamentoStatus: servico.pagamentoStatus,
        aprovada: sql<boolean>`${servico.aprovadoEm} is not null`,
        dataAbertura: servico.dataAbertura,
        previsaoEntrega: servico.previsaoEntrega,
        defeitoRelatado: servico.defeitoRelatado,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        clienteTelefone: cliente.telefone,
        equipamentoId: servico.equipamentoId,
        equipamento: sql<string>`${equipamento.marca} || ' ' || ${equipamento.modelo}`,
      })
      .from(servico)
      .innerJoin(statusOs, eq(servico.statusId, statusOs.id))
      .innerJoin(cliente, eq(servico.clienteId, cliente.id))
      .innerJoin(equipamento, eq(servico.equipamentoId, equipamento.id))
      .where(
        and(
          statusId ? eq(servico.statusId, statusId) : undefined,
          fase ? eq(statusOs.fase, fase) : undefined,
          tipo ? eq(servico.tipoAtendimento, tipo) : undefined,
          pagamento ? eq(servico.pagamentoStatus, pagamento) : undefined,
          clienteId ? eq(servico.clienteId, clienteId) : undefined,
          equipamentoId ? eq(servico.equipamentoId, equipamentoId) : undefined,
          busca ? or(ilike(cliente.nome, `%${busca}%`), numero ? eq(servico.id, numero) : undefined) : undefined
        )
      )
      .orderBy(desc(servico.id))
      .limit(500);

    res.json(lista);
  } catch (err) {
    responderErro(res, err);
  }
});

router.get("/os/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const os = await carregarOS(id);
    if (!os) return res.status(404).json({ erro: "OS não encontrada." });
    res.json(os);
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /os -> abre a OS ja com os itens, no status padrao. Tudo numa
// transacao: ou salva tudo (OS + itens + total), ou nao salva nada.
router.post("/os", async (req, res) => {
  try {
    const { itens, ...dados } = abrirSchema.parse(req.body);

    // Junta itens repetidos somando a quantidade
    const quantidades = new Map<number, number>();
    for (const i of itens) quantidades.set(i.itemId, (quantidades.get(i.itemId) ?? 0) + i.quantidade);

    const id = await db.transaction(async (tx) => {
      const [maquina] = await tx
        .select({ clienteId: equipamento.clienteId })
        .from(equipamento)
        .where(eq(equipamento.id, dados.equipamentoId));
      if (!maquina || maquina.clienteId !== dados.clienteId) {
        throw new ErroRegra("A máquina selecionada não pertence a esse cliente.");
      }

      const [inicial] = await tx.select({ id: statusOs.id }).from(statusOs).where(eq(statusOs.padrao, true));
      if (!inicial) throw new ErroRegra("Nenhum status padrão configurado para novas OS.");

      const precos = quantidades.size
        ? await tx
            .select({ id: item.id, valorUnitario: item.valorUnitario, valorCusto: item.valorCusto })
            .from(item)
            .where(inArray(item.id, [...quantidades.keys()]))
        : [];
      if (precos.length !== quantidades.size) throw new ErroRegra("Algum item informado não existe.");

      // Vendedor e loja vem do token, nao do front
      const [nova] = await tx
        .insert(servico)
        .values({
          ...dados,
          enderecoAtendimento: dados.tipoAtendimento === "campo" ? dados.enderecoAtendimento : null,
          dataVisita: dados.tipoAtendimento === "campo" ? dados.dataVisita : null,
          statusId: inicial.id,
          vendedorId: req.usuario!.id,
          lojaId: req.usuario!.lojaId,
        })
        .returning({ id: servico.id });

      if (precos.length) {
        await tx.insert(servicoItem).values(
          precos.map((p) => ({
            servicoId: nova.id,
            itemId: p.id,
            quantidade: quantidades.get(p.id)!,
            valorUnitario: p.valorUnitario, // precos congelados
            valorCusto: p.valorCusto,
          }))
        );
      }

      await recalcularTotal(tx, nova.id);
      return nova.id;
    });

    res.status(201).json(await carregarOS(id));
  } catch (err) {
    if (err instanceof ErroRegra) return res.status(400).json({ erro: err.message });
    responderErro(res, err);
  }
});

// PUT /os/:id -> dados do atendimento (oficina/campo, defeito, diagnostico...)
router.put("/os/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = atendimentoSchema.parse(req.body);
    const situacao = await buscarSituacao(id);
    if (!situacao) return res.status(404).json({ erro: "OS não encontrada." });
    // Depois de entregue ou cancelada, a OS vira registro historico
    if (faseFinal(situacao.fase)) {
      return res.status(409).json({ erro: "OS entregue ou cancelada não pode ser alterada." });
    }

    await db
      .update(servico)
      .set({
        ...dados,
        enderecoAtendimento: dados.tipoAtendimento === "campo" ? dados.enderecoAtendimento : null,
        dataVisita: dados.tipoAtendimento === "campo" ? dados.dataVisita : null,
      })
      .where(eq(servico.id, id));
    res.json(await carregarOS(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// PUT /os/:id/pagamento { desconto, formaPagamento, pagamentoStatus }
router.put("/os/:id/pagamento", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = pagamentoSchema.parse(req.body);
    const situacao = await buscarSituacao(id);
    if (!situacao) return res.status(404).json({ erro: "OS não encontrada." });
    if (situacao.fase === "cancelada") return res.status(409).json({ erro: "OS cancelada não pode ser alterada." });

    const descontoMudou = Number(dados.desconto) !== Number(situacao.desconto);
    if (descontoMudou && faseFinal(situacao.fase)) {
      return res.status(409).json({ erro: "O desconto não pode ser alterado depois da entrega." });
    }
    if (Number(dados.desconto) > Number(situacao.valorItens)) {
      return res.status(400).json({ erro: "O desconto não pode ser maior que o valor dos itens." });
    }
    if (dados.pagamentoStatus === "pago" && !dados.formaPagamento) {
      return res.status(400).json({ erro: "Informe a forma de pagamento." });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(servico)
        .set({
          ...dados,
          // Guarda quando foi pago (mantem a data se ja estava pago)
          dataPagamento:
            dados.pagamentoStatus === "pago" ? (situacao.dataPagamento ?? new Date()) : null,
        })
        .where(eq(servico.id, id));
      await recalcularTotal(tx, id);
      if (descontoMudou && situacao.fase === "aberta") await invalidarAprovacao(tx, id);
    });
    res.json(await carregarOS(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /os/:id/aprovar -> cliente e tecnico assinam na tela
router.post("/os/:id/aprovar", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = aprovarSchema.parse(req.body);
    const situacao = await buscarSituacao(id);
    if (!situacao) return res.status(404).json({ erro: "OS não encontrada." });
    if (situacao.fase !== "aberta") {
      return res.status(409).json({ erro: "Só é possível aprovar uma OS que ainda não foi iniciada." });
    }

    await db
      .update(servico)
      .set({ ...dados, aprovadoEm: new Date() })
      .where(eq(servico.id, id));
    res.json(await carregarOS(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// PATCH /os/:id/status { statusId }
router.patch("/os/:id/status", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const { statusId } = z.object({ statusId: idSchema("Status") }).parse(req.body);
    const situacao = await buscarSituacao(id);
    if (!situacao) return res.status(404).json({ erro: "OS não encontrada." });

    const [novo] = await db.select().from(statusOs).where(eq(statusOs.id, statusId));
    if (!novo || !novo.ativo) return res.status(400).json({ erro: "Status inválido ou desativado." });
    if (novo.id === situacao.statusId) return res.json(await carregarOS(id));

    const erro = validarTrocaDeFase(situacao, novo.fase);
    if (erro) return res.status(409).json({ erro });

    await db
      .update(servico)
      .set({
        statusId: novo.id,
        // Registra quando foi concluida/entregue. Se voltar para antes, limpa.
        ...(novo.fase === "concluida" && situacao.fase !== "concluida" ? { dataConclusao: new Date() } : {}),
        ...(novo.fase === "aberta" || novo.fase === "execucao" ? { dataConclusao: null } : {}),
        ...(novo.fase === "entregue" ? { dataEntrega: new Date() } : {}),
      })
      .where(eq(servico.id, id));

    res.json(await carregarOS(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /os/:id/avisos { mensagem } -> "ja avisei o cliente pelo WhatsApp"
router.post("/os/:id/avisos", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const { mensagem } = z.object({ mensagem: textoObrigatorio("Mensagem", 2000) }).parse(req.body);
    const situacao = await buscarSituacao(id);
    if (!situacao) return res.status(404).json({ erro: "OS não encontrada." });

    await db.insert(avisoCliente).values({ servicoId: id, vendedorId: req.usuario!.id, mensagem });
    res.status(201).json(await carregarOS(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /os/:id/itens { itemId, quantidade } -> adiciona (ou soma, se ja existir)
router.post("/os/:id/itens", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = z.object({ itemId: idSchema("Item"), quantidade: quantidadeSchema }).parse(req.body);
    const situacao = await verificarItensEditaveis(id);
    if ("erro" in situacao) return res.status(situacao.codigo).json({ erro: situacao.erro });

    const [escolhido] = await db
      .select({ valorUnitario: item.valorUnitario, valorCusto: item.valorCusto })
      .from(item)
      .where(eq(item.id, dados.itemId));
    if (!escolhido) return res.status(400).json({ erro: "Item não encontrado." });

    await db.transaction(async (tx) => {
      await tx
        .insert(servicoItem)
        .values({ servicoId: id, ...dados, ...escolhido })
        // Ja estava na OS: soma a quantidade e mantem o preco original
        .onConflictDoUpdate({
          target: [servicoItem.servicoId, servicoItem.itemId],
          set: { quantidade: sql`${servicoItem.quantidade} + excluded.quantidade` },
        });
      await recalcularTotal(tx, id);
      if (situacao.fase === "aberta") await invalidarAprovacao(tx, id);
    });

    res.status(201).json(await carregarOS(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// PUT /os/:id/itens/:itemOsId { quantidade }
router.put("/os/:id/itens/:itemOsId", async (req, res) => {
  const id = lerId(req.params.id);
  const itemOsId = lerId(req.params.itemOsId);
  if (!id || !itemOsId) return res.status(400).json({ erro: "Id inválido." });

  try {
    const { quantidade } = z.object({ quantidade: quantidadeSchema }).parse(req.body);
    const situacao = await verificarItensEditaveis(id);
    if ("erro" in situacao) return res.status(situacao.codigo).json({ erro: situacao.erro });

    const alterado = await db.transaction(async (tx) => {
      const linhas = await tx
        .update(servicoItem)
        .set({ quantidade })
        .where(and(eq(servicoItem.id, itemOsId), eq(servicoItem.servicoId, id)))
        .returning({ id: servicoItem.id });
      await recalcularTotal(tx, id);
      if (linhas.length && situacao.fase === "aberta") await invalidarAprovacao(tx, id);
      return linhas.length > 0;
    });
    if (!alterado) return res.status(404).json({ erro: "Item não está nessa OS." });

    res.json(await carregarOS(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// DELETE /os/:id/itens/:itemOsId
router.delete("/os/:id/itens/:itemOsId", async (req, res) => {
  const id = lerId(req.params.id);
  const itemOsId = lerId(req.params.itemOsId);
  if (!id || !itemOsId) return res.status(400).json({ erro: "Id inválido." });

  try {
    const situacao = await verificarItensEditaveis(id);
    if ("erro" in situacao) return res.status(situacao.codigo).json({ erro: situacao.erro });

    const removido = await db.transaction(async (tx) => {
      const linhas = await tx
        .delete(servicoItem)
        .where(and(eq(servicoItem.id, itemOsId), eq(servicoItem.servicoId, id)))
        .returning({ id: servicoItem.id });
      await recalcularTotal(tx, id);
      if (linhas.length && situacao.fase === "aberta") await invalidarAprovacao(tx, id);
      return linhas.length > 0;
    });
    if (!removido) return res.status(404).json({ erro: "Item não está nessa OS." });

    res.json(await carregarOS(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// ---- auxiliares ----

class ErroRegra extends Error {}

// Fase atual, aprovacao e valores da OS (para validar as regras)
async function buscarSituacao(id: number) {
  const [os] = await db
    .select({
      statusId: servico.statusId,
      fase: statusOs.fase,
      aprovada: sql<boolean>`${servico.aprovadoEm} is not null`,
      quantidadeItens: sql<number>`(select count(*)::int from ${servicoItem} where ${servicoItem.servicoId} = ${servico.id})`,
      desconto: servico.desconto,
      valorItens: servico.valorItens,
      dataPagamento: servico.dataPagamento,
    })
    .from(servico)
    .innerJoin(statusOs, eq(servico.statusId, statusOs.id))
    .where(eq(servico.id, id));
  return os ? { ...os, fase: os.fase as Fase } : null;
}

async function verificarItensEditaveis(id: number) {
  const situacao = await buscarSituacao(id);
  if (!situacao) return { codigo: 404, erro: "OS não encontrada." };
  if (!itensEditaveis(situacao.fase)) {
    return { codigo: 409, erro: "Os itens não podem ser alterados depois que a OS é concluída." };
  }
  return situacao;
}

export default router;
