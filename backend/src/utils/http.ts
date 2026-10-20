import { Response } from "express";
import { ZodError } from "zod";

// Converte o :id da URL em numero. Retorna null se nao for um id valido.
export function lerId(valor: string): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Mensagens amigaveis para cada restricao UNIQUE do banco
const MENSAGENS_DUPLICIDADE: Record<string, string> = {
  cliente_cpf_cnpj_unique: "Já existe um cliente com esse CPF/CNPJ.",
  vendedor_email_unique: "Já existe um vendedor com esse e-mail.",
};

// Tratamento de erro padrao das rotas: responde sempre no formato { erro }.
export function responderErro(res: Response, err: unknown) {
  // Dados enviados nao passaram na validacao do zod
  if (err instanceof ZodError) {
    const primeiro = err.issues[0];
    return res.status(400).json({ erro: primeiro.message });
  }

  // Codigos de erro do PostgreSQL. O Drizzle embrulha o erro original
  // do banco dentro de err.cause, por isso olhamos os dois.
  type ErroBanco = { code?: string; constraint?: string; cause?: unknown };
  const externo = (err ?? {}) as ErroBanco;
  const erroBanco = (externo.code ? externo : externo.cause ?? {}) as ErroBanco;
  const { code: codigo, constraint } = erroBanco;
  if (codigo === "23505") {
    const mensagem =
      MENSAGENS_DUPLICIDADE[constraint ?? ""] ?? "Já existe um registro com esses dados.";
    return res.status(409).json({ erro: mensagem });
  }
  if (codigo === "23503") {
    return res
      .status(409)
      .json({ erro: "Registro vinculado a outros dados, não pode ser alterado ou excluído." });
  }

  console.error(err);
  return res.status(500).json({ erro: "Erro interno no servidor." });
}
