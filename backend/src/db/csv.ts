// Leitura das planilhas exportadas do Tiny ERP (usada pelos scripts de importacao)

export type Linha = Record<string, string>;

// Leitor de CSV (campos entre aspas podem ter virgulas, aspas "" e quebras de linha)
export function lerCsv(texto: string): Linha[] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo || linha.length) linhas.push([...linha, campo]);

  const [cabecalho, ...dados] = linhas;
  return dados
    .filter((l) => l.length > 1)
    .map((l) => Object.fromEntries(cabecalho.map((h, i) => [h.trim(), (l[i] ?? "").trim()])));
}
