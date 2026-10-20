import { Router } from "express";
import { z } from "zod";
import { asc, eq, ilike, or } from "drizzle-orm";
import { db } from "../db";
import { cliente } from "../db/schema";
import { autenticar } from "../middleware/auth";
import { lerId, responderErro } from "../utils/http";
import { somenteDigitos, textoObrigatorio, textoOpcional } from "../utils/validacao";

const router = Router();
router.use("/clientes", autenticar);

const clienteSchema = z.object({
  nome: textoObrigatorio("Nome", 120),
  cpfCnpj: textoOpcional(18)
    .transform((v) => (v ? somenteDigitos(v) : null))
    .refine((v) => v === null || v.length === 11 || v.length === 14, {
      message: "CPF deve ter 11 dígitos ou CNPJ 14 dígitos.",
    }),
  telefone: textoOpcional(20),
  email: textoOpcional(160).refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    { message: "E-mail inválido." }
  ),
  endereco: textoOpcional(255),
  cidade: textoOpcional(80),
  cep: textoOpcional(9)
    .transform((v) => (v ? somenteDigitos(v) : null))
    .refine((v) => v === null || v.length === 8, { message: "CEP deve ter 8 dígitos." }),
});

// GET /clientes?busca=maria -> lista (filtra por nome ou CPF/CNPJ)
router.get("/clientes", async (req, res) => {
  try {
    const busca = typeof req.query.busca === "string" ? req.query.busca.trim() : "";
    const digitos = somenteDigitos(busca);

    const filtro = busca
      ? or(
          ilike(cliente.nome, `%${busca}%`),
          digitos ? ilike(cliente.cpfCnpj, `%${digitos}%`) : undefined
        )
      : undefined;

    const lista = await db.select().from(cliente).where(filtro).orderBy(asc(cliente.nome));
    res.json(lista);
  } catch (err) {
    responderErro(res, err);
  }
});

// GET /clientes/:id
router.get("/clientes/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const [encontrado] = await db.select().from(cliente).where(eq(cliente.id, id));
    if (!encontrado) return res.status(404).json({ erro: "Cliente não encontrado." });
    res.json(encontrado);
  } catch (err) {
    responderErro(res, err);
  }
});

// POST /clientes
router.post("/clientes", async (req, res) => {
  try {
    const dados = clienteSchema.parse(req.body);
    const [criado] = await db.insert(cliente).values(dados).returning();
    res.status(201).json(criado);
  } catch (err) {
    responderErro(res, err);
  }
});

// PUT /clientes/:id
router.put("/clientes/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = clienteSchema.parse(req.body);
    const [atualizado] = await db
      .update(cliente)
      .set(dados)
      .where(eq(cliente.id, id))
      .returning();
    if (!atualizado) return res.status(404).json({ erro: "Cliente não encontrado." });
    res.json(atualizado);
  } catch (err) {
    responderErro(res, err);
  }
});

// DELETE /clientes/:id -> bloqueado pelo banco se o cliente ja tiver OS
router.delete("/clientes/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const [removido] = await db.delete(cliente).where(eq(cliente.id, id)).returning();
    if (!removido) return res.status(404).json({ erro: "Cliente não encontrado." });
    res.status(204).send();
  } catch (err) {
    responderErro(res, err);
  }
});

export default router;
