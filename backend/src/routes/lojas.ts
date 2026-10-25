import { Router } from "express";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { loja } from "../db/schema";
import { apenasGestor, autenticar } from "../middleware/auth";
import { lerId, responderErro } from "../utils/http";
import { textoObrigatorio, textoOpcional } from "../utils/validacao";

const router = Router();
router.use("/lojas", autenticar);

const lojaSchema = z.object({
  nome: textoObrigatorio("Nome", 120),
  endereco: textoOpcional(255),
});

// Leitura liberada para qualquer usuario logado
router.get("/lojas", async (_req, res) => {
  try {
    const lista = await db.select().from(loja).orderBy(asc(loja.nome));
    res.json(lista);
  } catch (err) {
    responderErro(res, err);
  }
});

router.get("/lojas/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const [encontrada] = await db.select().from(loja).where(eq(loja.id, id));
    if (!encontrada) return res.status(404).json({ erro: "Loja não encontrada." });
    res.json(encontrada);
  } catch (err) {
    responderErro(res, err);
  }
});

// Criar, editar e excluir: apenas gestor
router.post("/lojas", apenasGestor, async (req, res) => {
  try {
    const dados = lojaSchema.parse(req.body);
    const [criada] = await db.insert(loja).values(dados).returning();
    res.status(201).json(criada);
  } catch (err) {
    responderErro(res, err);
  }
});

router.put("/lojas/:id", apenasGestor, async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = lojaSchema.parse(req.body);
    const [atualizada] = await db.update(loja).set(dados).where(eq(loja.id, id)).returning();
    if (!atualizada) return res.status(404).json({ erro: "Loja não encontrada." });
    res.json(atualizada);
  } catch (err) {
    responderErro(res, err);
  }
});

// Bloqueado pelo banco se a loja tiver vendedores ou OS vinculados
router.delete("/lojas/:id", apenasGestor, async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const [removida] = await db.delete(loja).where(eq(loja.id, id)).returning();
    if (!removida) return res.status(404).json({ erro: "Loja não encontrada." });
    res.status(204).send();
  } catch (err) {
    responderErro(res, err);
  }
});

export default router;
