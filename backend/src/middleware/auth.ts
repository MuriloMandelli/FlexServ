import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Dados que o /login coloca dentro do token
export type UsuarioToken = {
  id: number;
  email: string;
  papel: "vendedor" | "gestor";
  lojaId: number;
};

// Deixa o req.usuario tipado em todas as rotas
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

// Exige o header "Authorization: Bearer <token>".
// Se o token for valido, salva os dados do usuario em req.usuario.
export function autenticar(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token não informado." });
  }

  const token = header.slice("Bearer ".length);

  try {
    const dados = jwt.verify(token, process.env.JWT_SECRET as string);
    req.usuario = dados as UsuarioToken;
    next();
  } catch {
    // Token expirado (passou das 8h), alterado ou assinado com outro segredo
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

// Usado depois do autenticar, em rotas que so o gestor pode acessar
export function apenasGestor(req: Request, res: Response, next: NextFunction) {
  if (req.usuario?.papel !== "gestor") {
    return res.status(403).json({ erro: "Acesso permitido apenas para gestores." });
  }
  next();
}
