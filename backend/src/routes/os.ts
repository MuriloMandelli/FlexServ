import { Router } from "express";
import { z } from "zod";
import { and, asc, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
import { dispositivoDaRequisicao, ipDaRequisicao, lerId, responderErro } from "../utils/http";
import {
  dinheiroOpcional,
  precoAplicado,
  dinheiroSchema,
  formaPagamentoSchema,
  pagamentoStatusSchema,
  textoObrigatorio,
  textoOpcional,
} from "../utils/validacao";
import {
  faseFinal,
  FASES,
  invalidarAceiteTecnico,
  invalidarAprovacao,
  itensEditaveis,
  recalcularTotal,
  validarTrocaDeFase,
} from "../services/os";
import type { Fase } from "../services/os";
import { prepararAprovacao, registrarAceite } from "../services/aprovacao";

// Ordens de Servico (tabela "servico")

const router = Router();
router.use("/os", autenticar);

const idSchema = (campo: string) =>
  z.coerce.number({ message: `${campo} é obrigatório.` }).int().positive(`${campo} é obrigatório.`);

// Id opcional: vazio vira null
const idOpcional = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), { message: "Id inválido." });

// O tecnico responsavel e um usuario do sistema (tabela vendedor)
const tecnico = alias(vendedor, "tecnico");

const quantidadeSchema = z.coerce
  .number({ message: "Quantidade inválida." })
  .int("A quantidade deve ser um número inteiro.")
  .min(1, "A quantidade mínima é 1.")
  .max(9999, "Quantidade muito alta.");

// Item lancado: valorUnitario so vale para itens de valor variavel
const linhaItemSchema = z.object({
  itemId: idSchema("Item"),
  quantidade: quantidadeSchema,
  valorUnitario: dinheiroOpcional("Valor do item"),
});

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
    defeitoRelatado: textoOpcional(2000),
    diagnostico: textoOpcional(2000),
    servicoExecutado: textoOpcional(2000),
    observacoes: textoOpcional(2000),
    previsaoEntrega: dataOpcional,
    garantiaDias: garantiaSchema,
    tecnicoId: idOpcional,
  })
  .refine(exigirEnderecoEmCampo, msgEndereco);

const abrirSchema = z
  .object({
    clienteId: idSchema("Cliente"),
    equipamentoId: idOpcional,
    tecnicoId: idOpcional,
    tipoAtendimento: tipoAtendimentoSchema.default("oficina"),
    enderecoAtendimento: textoOpcional(255),
    dataVisita: dataHoraOpcional,
    defeitoRelatado: textoOpcional(2000),
    observacoes: textoOpcional(2000),
    previsaoEntrega: dataOpcional,
    garantiaDias: garantiaSchema,
    itens: z.array(linhaItemSchema).default([]),
  })
  .refine(exigirEnderecoEmCampo, msgEndereco);

const pagamentoSchema = z.object({
  desconto: dinheiroSchema("Desconto"),
  formaPagamento: formaPagamentoSchema,
  pagamentoStatus: pagamentoStatusSchema,
});

// Dados do status (nome, cor, fase) para juntar nas consultas
const colunasStatus = { id: statusOs.id, nome: statusOs.nome, cor: statusOs.cor, fase: statusOs.fase };

// Monta a OS completa: dados, cliente, maquina, vendedor, tecnico, status, itens e avisos
async function carregarOS(id: number) {
  // As assinaturas desenhadas (legado) ficam de fora da resposta
  const { assinaturaCliente: _c, assinaturaTecnico: _t, ...colunasServico } = getTableColumns(servico);
  const [os] = await db
    .select({
      os: colunasServico,
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
      tecnico: { id: tecnico.id, nome: tecnico.nome, telefone: tecnico.telefone },
    })
    .from(servico)
    .innerJoin(statusOs, eq(servico.statusId, statusOs.id))
    .innerJoin(cliente, eq(servico.clienteId, cliente.id))
    .leftJoin(equipamento, eq(servico.equipamentoId, equipamento.id))
    .innerJoin(vendedor, eq(servico.vendedorId, vendedor.id))
    .leftJoin(tecnico, eq(servico.tecnicoId, tecnico.id))
    .where(eq(servico.id, id));

  if (!os) return null;

  const [itens, avisos] = await Promise.all([
    db
      .select({
        id: servicoItem.id,
        itemId: servicoItem.itemId,
        nome: item.nome,
        tipo: item.tipo,
        valorVariavel: item.valorVariavel,
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
    // OS antigas sem tecnico: o responsavel e quem abriu
    tecnico: os.tecnico ?? { ...os.vendedor, telefone: null },
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
        equipamento: sql<string | null>`${equipamento.marca} || ' ' || ${equipamento.modelo}`,
        tecnicoNome: tecnico.nome,
      })
      .from(servico)
      .innerJoin(statusOs, eq(servico.statusId, statusOs.id))
      .innerJoin(cliente, eq(servico.clienteId, cliente.id))
      .leftJoin(equipamento, eq(servico.equipamentoId, equipamento.id))
      .leftJoin(tecnico, eq(servico.tecnicoId, tecnico.id))
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

    // Junta itens repetidos somando a quantidade (e guarda o valor informado)
    const quantidades = new Map<number, number>();
    const informados = new Map<number, string | null>();
    for (const i of itens) {
      quantidades.set(i.itemId, (quantidades.get(i.itemId) ?? 0) + i.quantidade);
      if (!informados.get(i.itemId)) informados.set(i.itemId, i.valorUnitario);
    }

    const id = await db.transaction(async (tx) => {
      // Maquina e opcional; se vier, tem que ser do cliente
      if (dados.equipamentoId) {
        const [maquina] = await tx
          .select({ clienteId: equipamento.clienteId })
          .from(equipamento)
          .where(eq(equipamento.id, dados.equipamentoId));
        if (!maquina || maquina.clienteId !== dados.clienteId) {
          throw new ErroRegra("A máquina selecionada não pertence a esse cliente.");
        }
      }
      // Sem tecnico escolhido, o responsavel e quem esta abrindo a OS
      const tecnicoId = dados.tecnicoId ?? req.usuario!.id;
      if (!(await usuarioExiste(tecnicoId))) throw new ErroRegra("Técnico responsável não encontrado.");

      const [inicial] = await tx.select({ id: statusOs.id }).from(statusOs).where(eq(statusOs.padrao, true));
      if (!inicial) throw new ErroRegra("Nenhum status padrão configurado para novas OS.");

      const precos = quantidades.size
        ? await tx
            .select({ id: item.id, valorUnitario: item.valorUnitario, valorCusto: item.valorCusto, valorVariavel: item.valorVariavel })
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
          tecnicoId,
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
            valorUnitario: precoAplicado(p, informados.get(p.id)), // precos congelados
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

    const { tecnicoId, ...atendimento } = dados;
    const tecnicoMudou = tecnicoId !== null && tecnicoId !== situacao.tecnicoId;
    if (tecnicoMudou && !(await usuarioExiste(tecnicoId))) {
      return res.status(400).json({ erro: "Técnico responsável não encontrado." });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(servico)
        .set({
          ...atendimento,
          ...(tecnicoMudou ? { tecnicoId } : {}),
          enderecoAtendimento: dados.tipoAtendimento === "campo" ? dados.enderecoAtendimento : null,
          dataVisita: dados.tipoAtendimento === "campo" ? dados.dataVisita : null,
        })
        .where(eq(servico.id, id));
      // Outro tecnico antes de iniciar: ele precisa dar o proprio aceite
      if (tecnicoMudou && situacao.fase === "aberta") await invalidarAceiteTecnico(tx, id);
    });
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

// POST /os/:id/aprovacao -> gera os links de aprovacao (cliente e tecnico)
// e congela os termos. O front monta a mensagem do WhatsApp com os links.
router.post("/os/:id/aprovacao", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const situacao = await buscarSituacao(id);
    if (!situacao) return res.status(404).json({ erro: "OS não encontrada." });
    const erro = podeAprovar(situacao);
    if (erro) return res.status(409).json({ erro });

    await prepararAprovacao(db, { id, ...situacao });
    res.json(await carregarOS(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /os/:id/aprovacao/tecnico -> o tecnico responsavel aceita direto no
// sistema (ja esta logado, entao nao precisa do link)
router.post("/os/:id/aprovacao/tecnico", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const situacao = await buscarSituacao(id);
    if (!situacao) return res.status(404).json({ erro: "OS não encontrada." });
    const erro = podeAprovar(situacao);
    if (erro) return res.status(409).json({ erro });
    if (situacao.aceiteTecnico) return res.status(409).json({ erro: "O técnico já assinou esta OS." });
    if ((situacao.tecnicoId ?? situacao.vendedorId) !== req.usuario!.id) {
      return res.status(403).json({ erro: "Só o técnico responsável pode assinar por aqui. Envie o link para ele." });
    }

    const [usuario] = await db.select({ nome: vendedor.nome }).from(vendedor).where(eq(vendedor.id, req.usuario!.id));
    await db.transaction(async (tx) => {
      await prepararAprovacao(tx, { id, ...situacao });
      await registrarAceite(tx, id, "tecnico", {
        nome: usuario.nome,
        ip: ipDaRequisicao(req),
        dispositivo: dispositivoDaRequisicao(req),
        meio: "sistema",
      });
    });
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
    const dados = linhaItemSchema.parse(req.body);
    const situacao = await verificarItensEditaveis(id);
    if ("erro" in situacao) return res.status(situacao.codigo).json({ erro: situacao.erro });

    const [escolhido] = await db
      .select({ valorUnitario: item.valorUnitario, valorCusto: item.valorCusto, valorVariavel: item.valorVariavel })
      .from(item)
      .where(eq(item.id, dados.itemId));
    if (!escolhido) return res.status(400).json({ erro: "Item não encontrado." });

    await db.transaction(async (tx) => {
      await tx
        .insert(servicoItem)
        .values({
          servicoId: id,
          itemId: dados.itemId,
          quantidade: dados.quantidade,
          valorUnitario: precoAplicado(escolhido, dados.valorUnitario),
          valorCusto: escolhido.valorCusto,
        })
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

// PUT /os/:id/itens/:itemOsId { quantidade?, valorUnitario? }
// O valor so pode ser mudado em itens de valor variavel
router.put("/os/:id/itens/:itemOsId", async (req, res) => {
  const id = lerId(req.params.id);
  const itemOsId = lerId(req.params.itemOsId);
  if (!id || !itemOsId) return res.status(400).json({ erro: "Id inválido." });

  try {
    const { quantidade, valorUnitario } = z
      .object({ quantidade: quantidadeSchema.optional(), valorUnitario: dinheiroOpcional("Valor do item") })
      .parse(req.body);
    const situacao = await verificarItensEditaveis(id);
    if ("erro" in situacao) return res.status(situacao.codigo).json({ erro: situacao.erro });

    if (valorUnitario !== null) {
      const [linha] = await db
        .select({ valorVariavel: item.valorVariavel })
        .from(servicoItem)
        .innerJoin(item, eq(servicoItem.itemId, item.id))
        .where(and(eq(servicoItem.id, itemOsId), eq(servicoItem.servicoId, id)));
      if (linha && !linha.valorVariavel) {
        return res.status(400).json({ erro: "O valor deste item é fixo (definido no cadastro)." });
      }
    }

    const alterado = await db.transaction(async (tx) => {
      const linhas = await tx
        .update(servicoItem)
        .set({
          ...(quantidade !== undefined ? { quantidade } : {}),
          ...(valorUnitario !== null ? { valorUnitario } : {}),
        })
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

async function usuarioExiste(id: number) {
  const [u] = await db.select({ id: vendedor.id }).from(vendedor).where(eq(vendedor.id, id));
  return Boolean(u);
}

// Regras para pedir ou registrar a aprovacao
function podeAprovar(s: { fase: Fase; aprovada: boolean; quantidadeItens: number; itensSemValor: number }) {
  if (s.fase !== "aberta") return "Só é possível aprovar uma OS que ainda não foi iniciada.";
  if (s.aprovada) return "Esta OS já está aprovada.";
  if (s.quantidadeItens === 0) return "Adicione os itens do orçamento antes de enviar para aprovação.";
  if (s.itensSemValor > 0) return "Informe o valor dos itens de valor variável antes de enviar para aprovação.";
  return null;
}

// Fase atual, aprovacao e valores da OS (para validar as regras)
async function buscarSituacao(id: number) {
  const [os] = await db
    .select({
      statusId: servico.statusId,
      vendedorId: servico.vendedorId,
      tecnicoId: servico.tecnicoId,
      termosAprovacao: servico.termosAprovacao,
      tokenCliente: servico.tokenCliente,
      tokenTecnico: servico.tokenTecnico,
      aceiteTecnico: sql<boolean>`${servico.aceiteTecnicoEm} is not null`,
      fase: statusOs.fase,
      aprovada: sql<boolean>`${servico.aprovadoEm} is not null`,
      quantidadeItens: sql<number>`(select count(*)::int from ${servicoItem} where ${servicoItem.servicoId} = ${servico.id})`,
      // Itens de valor variavel ainda sem valor (R$ 0,00)
      itensSemValor: sql<number>`(select count(*)::int from ${servicoItem} inner join ${item} on ${item.id} = ${servicoItem.itemId} where ${servicoItem.servicoId} = ${servico.id} and ${item.valorVariavel} and ${servicoItem.valorUnitario} = 0)`,
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
