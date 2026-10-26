import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { exportarTabelaPdf } from "../pdf";
import { Icone } from "./Icones";
import { Botao } from "./ui";

// Tabela reaproveitada nas listagens:
// - clique no cabecalho ordena (clicar de novo inverte a ordem)
// - "Exportar PDF" gera um relatorio com as linhas ja filtradas e ordenadas
// - no celular vira cartoes, com um seletor "Ordenar por"

export type Coluna<T> = {
  titulo: string;
  // Valor usado para ordenar (e mostrado, se nao houver "exibir")
  valor: (linha: T) => string | number | null;
  exibir?: (linha: T) => ReactNode;
  // Texto que vai no PDF (padrao: o proprio valor)
  pdf?: (linha: T) => string;
  direita?: boolean;
};

type Ordem = { coluna: number; crescente: boolean } | null;

export function Tabela<T>({
  colunas,
  linhas,
  chave,
  aoClicar,
  cartao,
  pdf,
}: {
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (linha: T) => string | number;
  aoClicar?: (linha: T) => void;
  // Como cada linha aparece no celular
  cartao: (linha: T) => ReactNode;
  pdf: { titulo: string; subtitulo?: string; nomeArquivo: string; resumo?: string };
}) {
  const [ordem, setOrdem] = useState<Ordem>(null);
  const [exportando, setExportando] = useState(false);

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas;
    const col = colunas[ordem.coluna];
    return [...linhas].sort((a, b) => {
      const va = col.valor(a);
      const vb = col.valor(b);
      if (va === vb) return 0;
      if (va === null || va === "") return 1;
      if (vb === null || vb === "") return -1;
      const r =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
      return ordem.crescente ? r : -r;
    });
  }, [linhas, colunas, ordem]);

  function ordenarPor(i: number) {
    setOrdem((atual) => (atual?.coluna === i ? { coluna: i, crescente: !atual.crescente } : { coluna: i, crescente: true }));
  }

  async function exportar() {
    setExportando(true);
    try {
      const criterio = ordem ? ` · ordenado por ${colunas[ordem.coluna].titulo.toLowerCase()}` : "";
      await exportarTabelaPdf({
        titulo: pdf.titulo,
        subtitulo: (pdf.subtitulo ?? "") + criterio,
        nomeArquivo: pdf.nomeArquivo,
        resumo: pdf.resumo,
        colunas: colunas.map((c) => ({ titulo: c.titulo, direita: c.direita })),
        linhas: ordenadas.map((l) => colunas.map((c) => (c.pdf ? c.pdf(l) : String(c.valor(l) ?? "")))),
      });
    } finally {
      setExportando(false);
    }
  }

  return (
    <div>
      {/* Barra: quantidade, ordenar (celular) e exportar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-suave">
          {linhas.length} {linhas.length === 1 ? "registro" : "registros"}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 md:hidden">
            <select
              value={ordem?.coluna ?? ""}
              onChange={(e) =>
                setOrdem(e.target.value === "" ? null : { coluna: Number(e.target.value), crescente: ordem?.crescente ?? true })
              }
              className="min-h-9 rounded-lg border border-borda bg-superficie px-2 text-sm"
              aria-label="Ordenar por"
            >
              <option value="">Ordenar por...</option>
              {colunas.map((c, i) => (
                <option key={c.titulo} value={i}>
                  {c.titulo}
                </option>
              ))}
            </select>
            {ordem && (
              <button
                type="button"
                onClick={() => setOrdem({ ...ordem, crescente: !ordem.crescente })}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-borda bg-superficie"
                aria-label="Inverter ordem"
              >
                {ordem.crescente ? "↑" : "↓"}
              </button>
            )}
          </div>
          <Botao variante="secundario" pequeno onClick={exportar} disabled={exportando || linhas.length === 0}>
            <Icone.pdf tamanho={16} /> {exportando ? "Gerando..." : "Exportar PDF"}
          </Botao>
        </div>
      </div>

      {/* Celular: cartoes */}
      <ul className="flex flex-col gap-2 md:hidden">
        {ordenadas.map((l) => (
          <li key={chave(l)}>
            {aoClicar ? (
              <button
                type="button"
                onClick={() => aoClicar(l)}
                className="block w-full rounded-2xl border border-borda bg-superficie p-4 text-left active:bg-superficie-2"
              >
                {cartao(l)}
              </button>
            ) : (
              <div className="rounded-2xl border border-borda bg-superficie p-4">{cartao(l)}</div>
            )}
          </li>
        ))}
      </ul>

      {/* Computador: tabela */}
      <div className="hidden overflow-x-auto rounded-2xl border border-borda bg-superficie/90 md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-borda">
              {colunas.map((c, i) => {
                const ativa = ordem?.coluna === i;
                return (
                  <th key={c.titulo} className={`px-4 py-3 font-medium ${c.direita ? "text-right" : ""}`}>
                    <button
                      type="button"
                      onClick={() => ordenarPor(i)}
                      title="Clique para ordenar (clique de novo para inverter)"
                      className={`inline-flex items-center gap-1 transition hover:text-texto ${
                        ativa ? "text-primaria" : "text-suave"
                      }`}
                    >
                      {c.titulo}
                      <span className="text-xs">{ativa ? (ordem!.crescente ? "▲" : "▼") : <Icone.ordenar tamanho={13} />}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <tr
                key={chave(l)}
                onClick={aoClicar ? () => aoClicar(l) : undefined}
                className={`border-b border-borda last:border-0 ${aoClicar ? "cursor-pointer hover:bg-superficie-2" : ""}`}
              >
                {colunas.map((c) => (
                  <td key={c.titulo} className={`px-4 py-3 ${c.direita ? "text-right tabular-nums" : ""}`}>
                    {c.exibir ? c.exibir(l) : c.valor(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
