import { Request, Response } from "express";
import { ZodError } from "zod";

// Converte o :id da URL em numero. Retorna null se nao for um id valido.
export function lerId(valor: string): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// IP de quem fez a requisicao (comprovante do aceite). Na Vercel o IP real
// vem no header x-forwarded-for; localmente, direto da conexao.
export function ipDaRequisicao(req: Request): string | null {
  const encaminhado = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(encaminhado) ? encaminhado[0] : encaminhado)?.split(",")[0].trim() || req.socket.remoteAddress;
  return ip ? ip.slice(0, 64) : null;
}

// Navegador/aparelho usado (comprovante do aceite)
export function dispositivoDaRequisicao(req: Request): string | null {
  return req.headers["user-agent"]?.slice(0, 255) ?? null;
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
