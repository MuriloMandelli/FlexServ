import { Router } from "express";
import { z } from "zod";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { item } from "../db/schema";
import { apenasGestor, autenticar } from "../middleware/auth";
import { lerId, responderErro } from "../utils/http";
import { dinheiroSchema, textoObrigatorio, textoOpcional } from "../utils/validacao";

// Itens cobrados na OS e nas vendas: pecas, maquinas e mao de obra

const router = Router();
router.use("/itens", autenticar);

const TIPOS = ["peca", "maquina", "mao_de_obra"] as const;

const itemSchema = z.object({
  nome: textoObrigatorio("Nome", 120),
  tipo: z.enum(TIPOS, { message: "Tipo deve ser peça, máquina ou mão de obra." }),
  descricao: textoOpcional(500),
  valorUnitario: dinheiroSchema("Valor de venda"),
  // Custo e opcional: usado so para o relatorio de lucro
  valorCusto: dinheiroSchema("Custo").default("0"),
  // Valor variavel: o preco e informado em cada OS/venda (o do cadastro e sugestao)
  valorVariavel: z.boolean().default(false),
});

// GET /itens?busca=agulha&tipo=peca
router.get("/itens", async (req, res) => {
  try {
    const busca = typeof req.query.busca === "string" ? req.query.busca.trim() : "";
    const tipo = TIPOS.find((t) => t === req.query.tipo);

    const lista = await db
      .select()
      .from(item)
      .where(and(busca ? ilike(item.nome, `%${busca}%`) : undefined, tipo ? eq(item.tipo, tipo) : undefined))
      .orderBy(asc(item.nome));
    res.json(lista);
  } catch (err) {
    responderErro(res, err);
  }
});

router.get("/itens/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const [encontrado] = await db.select().from(item).where(eq(item.id, id));
    if (!encontrado) return res.status(404).json({ erro: "Item não encontrado." });
    res.json(encontrado);
  } catch (err) {
    responderErro(res, err);
  }
});

// Precos sao definidos pelo gestor
router.post("/itens", apenasGestor, async (req, res) => {
  try {
    const dados = itemSchema.parse(req.body);
    const [criado] = await db.insert(item).values(dados).returning();
    res.status(201).json(criado);
  } catch (err) {
    responderErro(res, err);
  }
});

// Mudar o preco aqui NAO altera OS ja abertas (o preco fica congelado em servico_item)
router.put("/itens/:id", apenasGestor, async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = itemSchema.parse(req.body);
    const [atualizado] = await db.update(item).set(dados).where(eq(item.id, id)).returning();
    if (!atualizado) return res.status(404).json({ erro: "Item não encontrado." });
    res.json(atualizado);
  } catch (err) {
    responderErro(res, err);
  }
});

// Bloqueado pelo banco se o item ja foi usado em alguma OS
router.delete("/itens/:id", apenasGestor, async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const [removido] = await db.delete(item).where(eq(item.id, id)).returning();
    if (!removido) return res.status(404).json({ erro: "Item não encontrado." });
    res.status(204).send();
  } catch (err) {
    responderErro(res, err);
  }
});

export default router;
