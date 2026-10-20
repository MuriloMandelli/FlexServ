import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { loja, vendedor } from "../db/schema";
import { apenasGestor, autenticar } from "../middleware/auth";
import { lerId, responderErro } from "../utils/http";
import { textoObrigatorio } from "../utils/validacao";

const router = Router();
// Todo o cadastro de vendedores e restrito ao gestor
router.use("/vendedores", autenticar, apenasGestor);

// Colunas devolvidas pela API. O senhaHash nunca sai do servidor.
const colunasPublicas = {
  id: vendedor.id,
  nome: vendedor.nome,
  email: vendedor.email,
  papel: vendedor.papel,
  lojaId: vendedor.lojaId,
  criadoEm: vendedor.criadoEm,
};

const vendedorBase = {
  nome: textoObrigatorio("Nome", 120),
  email: textoObrigatorio("E-mail", 160).toLowerCase().email("E-mail inválido."),
  papel: z.enum(["vendedor", "gestor"], { message: "Papel deve ser vendedor ou gestor." }),
  lojaId: z.coerce.number({ message: "Loja é obrigatória." }).int().positive("Loja é obrigatória."),
};

// No cadastro a senha e obrigatoria
const criarSchema = z.object({
  ...vendedorBase,
  senha: z.string({ required_error: "Senha é obrigatória." }).min(6, "A senha deve ter no mínimo 6 caracteres."),
});

// Na edicao a senha e opcional: so troca se vier preenchida
const editarSchema = z.object({
  ...vendedorBase,
  senha: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || v.length >= 6, {
      message: "A senha deve ter no mínimo 6 caracteres.",
    }),
});

async function lojaExiste(id: number) {
  const [l] = await db.select({ id: loja.id }).from(loja).where(eq(loja.id, id));
  return Boolean(l);
}

router.get("/vendedores", async (_req, res) => {
  try {
    const lista = await db.select(colunasPublicas).from(vendedor).orderBy(asc(vendedor.nome));
    res.json(lista);
  } catch (err) {
    responderErro(res, err);
  }
});

router.get("/vendedores/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const [encontrado] = await db.select(colunasPublicas).from(vendedor).where(eq(vendedor.id, id));
    if (!encontrado) return res.status(404).json({ erro: "Vendedor não encontrado." });
    res.json(encontrado);
  } catch (err) {
    responderErro(res, err);
  }
});

router.post("/vendedores", async (req, res) => {
  try {
    const { senha, ...dados } = criarSchema.parse(req.body);
    if (!(await lojaExiste(dados.lojaId))) {
      return res.status(400).json({ erro: "Loja não encontrada." });
    }

    // Mesmo custo (10) usado no seed; o login compara com bcrypt.compare
    const senhaHash = await bcrypt.hash(senha, 10);
    const [criado] = await db
      .insert(vendedor)
      .values({ ...dados, senhaHash })
      .returning(colunasPublicas);
    res.status(201).json(criado);
  } catch (err) {
    responderErro(res, err);
  }
});

router.put("/vendedores/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const { senha, ...dados } = editarSchema.parse(req.body);

    // Impede o gestor logado de tirar o proprio acesso de gestor
    if (id === req.usuario!.id && dados.papel !== "gestor") {
      return res.status(400).json({ erro: "Você não pode remover o seu próprio acesso de gestor." });
    }
    if (!(await lojaExiste(dados.lojaId))) {
      return res.status(400).json({ erro: "Loja não encontrada." });
    }

    const alteracoes = senha ? { ...dados, senhaHash: await bcrypt.hash(senha, 10) } : dados;
    const [atualizado] = await db
      .update(vendedor)
      .set(alteracoes)
      .where(eq(vendedor.id, id))
      .returning(colunasPublicas);
    if (!atualizado) return res.status(404).json({ erro: "Vendedor não encontrado." });
    res.json(atualizado);
  } catch (err) {
    responderErro(res, err);
  }
});

// Bloqueado pelo banco se o vendedor ja tiver aberto alguma OS
router.delete("/vendedores/:id", async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });
  if (id === req.usuario!.id) {
    return res.status(400).json({ erro: "Você não pode excluir o seu próprio usuário." });
  }

  try {
    const [removido] = await db
      .delete(vendedor)
      .where(eq(vendedor.id, id))
      .returning({ id: vendedor.id });
    if (!removido) return res.status(404).json({ erro: "Vendedor não encontrado." });
    res.status(204).send();
  } catch (err) {
    responderErro(res, err);
  }
});

export default router;
