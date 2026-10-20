import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { vendedor } from "../db/schema";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
  }

  try {
    const [usuario] = await db
      .select()
      .from(vendedor)
      .where(eq(vendedor.email, email));

    if (!usuario) {
      return res.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      return res.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET não definido no .env");
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        papel: usuario.papel,
        lojaId: usuario.lojaId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro interno ao autenticar." });
  }
});

export default router;
