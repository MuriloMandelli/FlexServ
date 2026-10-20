import { Router } from "express";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { cliente, equipamento } from "../db/schema";
import { autenticar } from "../middleware/auth";
import { lerId, responderErro } from "../utils/http";
import { textoObrigatorio, textoOpcional } from "../utils/validacao";

// Maquinas de costura dos clientes

const router = Router();
router.use(["/equipamentos", "/clientes/:clienteId/equipamentos"], autenticar);

const equipamentoSchema = z.object({
  tipo: z.enum(["industrial", "domestica"], { message: "Tipo deve ser industrial ou doméstica." }),
  marca: textoObrigatorio("Marca", 60),
  modelo: textoObrigatorio("Modelo", 80),
  numeroSerie: textoOpcional(60),
});

// GET /clientes/:clienteId/equipamentos -> maquinas de um cliente
router.get("/clientes/:clienteId/equipamentos", async (req, res) => {
  const clienteId = lerId(req.params.clienteId);
  if (!clienteId) return res.status(400).json({ erro: "Id inválido." });

  try {
    const lista = await db
      .select()
      .from(equipamento)
      .where(eq(equipamento.clienteId, clienteId))
      .orderBy(asc(equipamento.marca), asc(equipamento.modelo));
    res.json(lista);
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /clientes/:clienteId/equipamentos
router.post("/clientes/:clienteId/equipamentos", async (req, res) => {
  const clienteId = lerId(req.params.clienteId);
  if (!clienteId) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = equipamentoSchema.parse(req.body);
    const [dono] = await db.select({ id: cliente.id }).from(cliente).where(eq(cliente.id, clienteId));
    if (!dono) return res.status(404).json({ erro: "Cliente não encontrado." });

    const [criado] = await db
      .insert(equipamento)
      .values({ ...dados, clienteId })
      .returning();
    res.status(201).json(criado);
  } catch (err) {
    responderErro(res, err);
  }
});

router.put("/equipamentos/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = equipamentoSchema.parse(req.body);
    const [atualizado] = await db
      .update(equipamento)
      .set(dados)
      .where(eq(equipamento.id, id))
      .returning();
    if (!atualizado) return res.status(404).json({ erro: "Máquina não encontrada." });
    res.json(atualizado);
  } catch (err) {
    responderErro(res, err);
  }
});

// Bloqueado pelo banco se a maquina ja tiver OS
router.delete("/equipamentos/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const [removido] = await db.delete(equipamento).where(eq(equipamento.id, id)).returning();
    if (!removido) return res.status(404).json({ erro: "Máquina não encontrada." });
    res.status(204).send();
  } catch (err) {
    responderErro(res, err);
  }
});

export default router;
