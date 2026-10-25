import { Router } from "express";
import { z } from "zod";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { avisoCliente, cliente, item, venda, vendaItem, vendedor } from "../db/schema";
import { autenticar } from "../middleware/auth";
import { lerId, responderErro } from "../utils/http";
import {
  dinheiroOpcional,
  precoAplicado,
  dinheiroSchema,
  formaPagamentoSchema,
  pagamentoStatusSchema,
  textoObrigatorio,
  textoOpcional,
} from "../utils/validacao";

// Vendas de balcao (pecas e maquinas). Separadas das OS de servico:
// a venda acontece na hora, sem diagnostico, aprovacao ou status de trabalho.

const router = Router();
router.use("/vendas", autenticar);

const quantidadeSchema = z.coerce
  .number({ message: "Quantidade inválida." })
  .int("A quantidade deve ser um número inteiro.")
  .min(1, "A quantidade mínima é 1.")
  .max(9999, "Quantidade muito alta.");

const novaVendaSchema = z.object({
  // Vazio = consumidor final (venda sem cadastro)
  clienteId: z.coerce.number().int().positive().nullish().transform((v) => v ?? null),
  itens: z
    .array(
      z.object({
        itemId: z.coerce.number().int().positive(),
        quantidade: quantidadeSchema,
        valorUnitario: dinheiroOpcional("Valor do item"), // so para itens de valor variavel
      })
    )
    .min(1, "Adicione pelo menos um item à venda."),
  desconto: dinheiroSchema("Desconto").default("0"),
  formaPagamento: formaPagamentoSchema,
  pagamentoStatus: pagamentoStatusSchema.default("pago"),
  observacoes: textoOpcional(2000),
});

async function carregarVenda(id: number) {
  const [v] = await db
    .select({
      venda,
      cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, cpfCnpj: cliente.cpfCnpj },
      vendedor: { id: vendedor.id, nome: vendedor.nome },
    })
    .from(venda)
    .leftJoin(cliente, eq(venda.clienteId, cliente.id))
    .innerJoin(vendedor, eq(venda.vendedorId, vendedor.id))
    .where(eq(venda.id, id));
  if (!v) return null;

  const [itens, avisos] = await Promise.all([
    db
      .select({
        id: vendaItem.id,
        itemId: vendaItem.itemId,
        nome: item.nome,
        tipo: item.tipo,
        quantidade: vendaItem.quantidade,
        valorUnitario: vendaItem.valorUnitario,
        subtotal: sql<string>`(${vendaItem.quantidade} * ${vendaItem.valorUnitario})::numeric(10,2)`,
      })
      .from(vendaItem)
      .innerJoin(item, eq(vendaItem.itemId, item.id))
      .where(eq(vendaItem.vendaId, id))
      .orderBy(asc(vendaItem.id)),
    db
      .select({ id: avisoCliente.id, mensagem: avisoCliente.mensagem, criadoEm: avisoCliente.criadoEm, vendedor: vendedor.nome })
      .from(avisoCliente)
      .innerJoin(vendedor, eq(avisoCliente.vendedorId, vendedor.id))
      .where(eq(avisoCliente.vendaId, id))
      .orderBy(desc(avisoCliente.id)),
  ]);

  return { ...v.venda, cliente: v.cliente, vendedor: v.vendedor, itens, avisos };
}

// GET /vendas?busca=&status=concluida|cancelada&pagamento=pendente|pago
router.get("/vendas", async (req, res) => {
  try {
    const q = req.query;
    const busca = typeof q.busca === "string" ? q.busca.trim() : "";
    const numero = /^#?\d+$/.test(busca) ? Number(busca.replace("#", "")) : null;
    const status = q.status === "concluida" || q.status === "cancelada" ? q.status : null;
    const pagamento = q.pagamento === "pendente" || q.pagamento === "pago" ? q.pagamento : null;

    const lista = await db
      .select({
        id: venda.id,
        data: venda.data,
        status: venda.status,
        valorTotal: venda.valorTotal,
        formaPagamento: venda.formaPagamento,
        pagamentoStatus: venda.pagamentoStatus,
        clienteId: venda.clienteId,
        clienteNome: sql<string>`coalesce(${cliente.nome}, 'Consumidor final')`,
        quantidadeItens: sql<number>`(select coalesce(sum(${vendaItem.quantidade}), 0)::int from ${vendaItem} where ${vendaItem.vendaId} = ${venda.id})`,
        vendedorNome: vendedor.nome,
      })
      .from(venda)
      .leftJoin(cliente, eq(venda.clienteId, cliente.id))
      .innerJoin(vendedor, eq(venda.vendedorId, vendedor.id))
      .where(
        and(
          status ? eq(venda.status, status) : undefined,
          pagamento ? eq(venda.pagamentoStatus, pagamento) : undefined,
          busca ? or(ilike(cliente.nome, `%${busca}%`), numero ? eq(venda.id, numero) : undefined) : undefined
        )
      )
      .orderBy(desc(venda.id))
      .limit(500);
    res.json(lista);
  } catch (err) {
    responderErro(res, err);
  }
});

router.get("/vendas/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });
  try {
    const v = await carregarVenda(id);
    if (!v) return res.status(404).json({ erro: "Venda não encontrada." });
    res.json(v);
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /vendas -> registra a venda com os itens, em uma transacao
router.post("/vendas", async (req, res) => {
  try {
    const dados = novaVendaSchema.parse(req.body);
    if (dados.pagamentoStatus === "pago" && !dados.formaPagamento) {
      return res.status(400).json({ erro: "Informe a forma de pagamento." });
    }

    const quantidades = new Map<number, number>();
    const informados = new Map<number, string | null>();
    for (const i of dados.itens) {
      quantidades.set(i.itemId, (quantidades.get(i.itemId) ?? 0) + i.quantidade);
      if (!informados.get(i.itemId)) informados.set(i.itemId, i.valorUnitario);
    }

    const id = await db.transaction(async (tx) => {
      if (dados.clienteId) {
        const [c] = await tx.select({ id: cliente.id }).from(cliente).where(eq(cliente.id, dados.clienteId));
        if (!c) throw new ErroRegra("Cliente não encontrado.");
      }

      const precos = await tx
        .select({ id: item.id, tipo: item.tipo, valorUnitario: item.valorUnitario, valorCusto: item.valorCusto, valorVariavel: item.valorVariavel })
        .from(item)
        .where(inArray(item.id, [...quantidades.keys()]));
      if (precos.length !== quantidades.size) throw new ErroRegra("Algum item informado não existe.");
      // Preco final de cada item (variavel = valor informado na venda)
      for (const p of precos) p.valorUnitario = precoAplicado(p, informados.get(p.id));
      // Mao de obra e servico: vai em OS, nao em venda de balcao
      if (precos.some((p) => p.tipo === "mao_de_obra")) {
        throw new ErroRegra("Mão de obra não pode ser vendida no balcão. Abra uma OS de serviço.");
      }

      const valorItens = precos.reduce((s, p) => s + quantidades.get(p.id)! * Number(p.valorUnitario), 0);
      if (Number(dados.desconto) > valorItens) throw new ErroRegra("O desconto não pode ser maior que o valor dos itens.");

      const [nova] = await tx
        .insert(venda)
        .values({
          clienteId: dados.clienteId,
          vendedorId: req.usuario!.id,
          lojaId: req.usuario!.lojaId,
          desconto: dados.desconto,
          formaPagamento: dados.formaPagamento,
          pagamentoStatus: dados.pagamentoStatus,
          dataPagamento: dados.pagamentoStatus === "pago" ? new Date() : null,
          observacoes: dados.observacoes,
        })
        .returning({ id: venda.id });

      await tx.insert(vendaItem).values(
        precos.map((p) => ({
          vendaId: nova.id,
          itemId: p.id,
          quantidade: quantidades.get(p.id)!,
          valorUnitario: p.valorUnitario, // precos congelados
          valorCusto: p.valorCusto,
        }))
      );

      // Total calculado pelo banco, como na OS
      const soma = sql`(select coalesce(sum(${vendaItem.quantidade} * ${vendaItem.valorUnitario}), 0) from ${vendaItem} where ${vendaItem.vendaId} = ${nova.id})`;
      await tx
        .update(venda)
        .set({ valorItens: soma, valorTotal: sql`greatest(${soma} - ${venda.desconto}, 0)` })
        .where(eq(venda.id, nova.id));

      return nova.id;
    });

    res.status(201).json(await carregarVenda(id));
  } catch (err) {
    if (err instanceof ErroRegra) return res.status(400).json({ erro: err.message });
    responderErro(res, err);
  }
});

// PUT /vendas/:id/pagamento { formaPagamento, pagamentoStatus }
router.put("/vendas/:id/pagamento", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });
  try {
    const dados = z
      .object({ formaPagamento: formaPagamentoSchema, pagamentoStatus: pagamentoStatusSchema })
      .parse(req.body);
    if (dados.pagamentoStatus === "pago" && !dados.formaPagamento) {
      return res.status(400).json({ erro: "Informe a forma de pagamento." });
    }
    const [atual] = await db.select().from(venda).where(eq(venda.id, id));
    if (!atual) return res.status(404).json({ erro: "Venda não encontrada." });
    if (atual.status === "cancelada") return res.status(409).json({ erro: "Venda cancelada não pode ser alterada." });

    await db
      .update(venda)
      .set({ ...dados, dataPagamento: dados.pagamentoStatus === "pago" ? (atual.dataPagamento ?? new Date()) : null })
      .where(eq(venda.id, id));
    res.json(await carregarVenda(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// PATCH /vendas/:id/cancelar
router.patch("/vendas/:id/cancelar", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });
  try {
    const [atual] = await db.select({ status: venda.status }).from(venda).where(eq(venda.id, id));
    if (!atual) return res.status(404).json({ erro: "Venda não encontrada." });
    if (atual.status === "cancelada") return res.status(409).json({ erro: "Venda já está cancelada." });
    await db.update(venda).set({ status: "cancelada" }).where(eq(venda.id, id));
    res.json(await carregarVenda(id));
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /vendas/:id/avisos { mensagem }
router.post("/vendas/:id/avisos", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });
  try {
    const { mensagem } = z.object({ mensagem: textoObrigatorio("Mensagem", 2000) }).parse(req.body);
    const [atual] = await db.select({ id: venda.id }).from(venda).where(eq(venda.id, id));
    if (!atual) return res.status(404).json({ erro: "Venda não encontrada." });
    await db.insert(avisoCliente).values({ vendaId: id, vendedorId: req.usuario!.id, mensagem });
    res.status(201).json(await carregarVenda(id));
  } catch (err) {
    responderErro(res, err);
  }
});

class ErroRegra extends Error {}

export default router;
