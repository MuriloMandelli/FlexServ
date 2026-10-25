import { Router } from "express";
import { z } from "zod";
import { asc, eq, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { servico, statusOs } from "../db/schema";
import { apenasGestor, autenticar } from "../middleware/auth";
import { lerId, responderErro } from "../utils/http";
import { textoObrigatorio } from "../utils/validacao";
import { FASES } from "../services/os";

// Status configuraveis da OS (tela "Gerenciar status")

const router = Router();
router.use("/status", autenticar);

const CORES = ["azul", "amarelo", "laranja", "verde", "cinza", "vermelho", "roxo", "rosa"] as const;

const statusSchema = z.object({
  nome: textoObrigatorio("Nome", 40),
  cor: z.enum(CORES, { message: "Cor inválida." }),
  fase: z.enum(FASES as [string, ...string[]], { message: "Fase inválida." }),
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  padrao: z.boolean().default(false),
  ativo: z.boolean().default(true),
});

function validarRegras(dados: z.infer<typeof statusSchema>) {
  if (dados.padrao && dados.fase !== "aberta") return "O status padrão de novas OS precisa ser da fase Aberta.";
  if (dados.padrao && !dados.ativo) return "O status padrão não pode ser desativado.";
  return null;
}

// Lista todos (a tela de gestao mostra inativos tambem)
router.get("/status", async (_req, res) => {
  try {
    const lista = await db
      .select({
        id: statusOs.id,
        nome: statusOs.nome,
        cor: statusOs.cor,
        fase: statusOs.fase,
        ordem: statusOs.ordem,
        padrao: statusOs.padrao,
        ativo: statusOs.ativo,
        quantidadeOs: sql<number>`(select count(*)::int from ${servico} where ${servico.statusId} = ${statusOs.id})`,
      })
      .from(statusOs)
      .orderBy(asc(statusOs.ordem), asc(statusOs.id));
    res.json(lista);
  } catch (err) {
    responderErro(res, err);
  }
});

router.post("/status", apenasGestor, async (req, res) => {
  try {
    const dados = statusSchema.parse(req.body);
    const erro = validarRegras(dados);
    if (erro) return res.status(400).json({ erro });

    const criado = await db.transaction(async (tx) => {
      // So pode existir um status padrao
      if (dados.padrao) await tx.update(statusOs).set({ padrao: false });
      const [novo] = await tx
        .insert(statusOs)
        .values({ ...dados, fase: dados.fase as (typeof statusOs.$inferInsert)["fase"] })
        .returning();
      return novo;
    });
    res.status(201).json(criado);
  } catch (err) {
    responderErro(res, err);
  }
});

router.put("/status/:id", apenasGestor, async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const dados = statusSchema.parse(req.body);
    const erro = validarRegras(dados);
    if (erro) return res.status(400).json({ erro });

    const [atual] = await db.select().from(statusOs).where(eq(statusOs.id, id));
    if (!atual) return res.status(404).json({ erro: "Status não encontrado." });
    if (atual.padrao && !dados.padrao) {
      return res.status(400).json({ erro: "Defina outro status como padrão antes de tirar o padrão deste." });
    }

    // Mudar a fase de um status em uso mudaria as regras de OS ja existentes
    if (atual.fase !== dados.fase) {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(servico)
        .where(eq(servico.statusId, id));
      if (total > 0) {
        return res.status(409).json({ erro: "Não é possível mudar a fase de um status que já está em uso por OS." });
      }
    }

    const atualizado = await db.transaction(async (tx) => {
      if (dados.padrao) await tx.update(statusOs).set({ padrao: false }).where(ne(statusOs.id, id));
      const [novo] = await tx
        .update(statusOs)
        .set({ ...dados, fase: dados.fase as (typeof statusOs.$inferInsert)["fase"] })
        .where(eq(statusOs.id, id))
        .returning();
      return novo;
    });
    res.json(atualizado);
  } catch (err) {
    responderErro(res, err);
  }
});

// Status em uso nao pode ser excluido (o banco bloqueia): use "desativar"
router.delete("/status/:id", apenasGestor, async (req, res) => {
  const id = lerId(req.params.id);
  if (!id) return res.status(400).json({ erro: "Id inválido." });

  try {
    const [atual] = await db.select().from(statusOs).where(eq(statusOs.id, id));
    if (!atual) return res.status(404).json({ erro: "Status não encontrado." });
    if (atual.padrao) return res.status(400).json({ erro: "O status padrão não pode ser excluído." });

    await db.delete(statusOs).where(eq(statusOs.id, id));
    res.status(204).send();
  } catch (err) {
    const causa = (err as { cause?: { code?: string } })?.cause;
    if (causa?.code === "23503") {
      return res.status(409).json({ erro: "Status em uso por alguma OS. Desative em vez de excluir." });
    }
    responderErro(res, err);
  }
});

export default router;
