// Cadastra as variaveis secretas da API na Vercel (rodar uma vez so).
// - DATABASE_URL: lida do backend/.env
// - JWT_SECRET: gerada agora, nova e forte
// Nenhum valor aparece na tela.
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");

const env = fs.readFileSync(".env", "utf8");
const banco = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!banco) {
  console.error("DATABASE_URL nao encontrada no backend/.env");
  process.exit(1);
}

const variaveis = {
  DATABASE_URL: banco,
  JWT_SECRET: crypto.randomBytes(32).toString("hex"),
};

for (const [nome, valor] of Object.entries(variaveis)) {
  // Remove se ja existir (para poder rodar de novo sem erro)
  try {
    execSync(`vercel env rm ${nome} production --yes`, { stdio: "ignore" });
  } catch {}
  execSync(`vercel env add ${nome} production`, { input: valor, stdio: ["pipe", "ignore", "inherit"] });
  console.log(`OK: ${nome} cadastrada na Vercel`);
}
