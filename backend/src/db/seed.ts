import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./index";
import { loja, vendedor } from "./schema";

async function seed() {
  const [novaLoja] = await db
    .insert(loja)
    .values({ nome: "Loja Matriz TecFlex", endereco: "Criciúma, SC" })
    .returning();

  const senhaHash = await bcrypt.hash("123456", 10);

  await db.insert(vendedor).values({
    nome: "Vendedor Teste",
    email: "vendedor@tecflex.com",
    senhaHash,
    papel: "gestor",
    lojaId: novaLoja.id,
  });

  console.log("Seed concluído: loja e vendedor de teste criados.");
  console.log("Login de teste -> email: vendedor@tecflex.com | senha: 123456");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
