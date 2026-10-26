import { formatarData } from "../formatar";
import type { OSDetalhe } from "../types";
import { Icone } from "./Icones";

// Barra no topo da OS: em que ponto ela esta e o que falta.
// Aberta -> Aprovada -> Em execucao -> Concluida -> Entregue
export function LinhaDoTempoOS({ os }: { os: OSDetalhe }) {
  const fase = os.status.fase;

  if (fase === "cancelada") {
    return (
      <div className="mb-4 rounded-xl border border-perigo/40 bg-perigo/10 px-4 py-3 text-sm font-semibold text-perigo">
        OS cancelada
      </div>
    );
  }

  const etapas = [
    { rotulo: "Aberta", data: os.dataAbertura },
    { rotulo: "Aprovada", data: os.aprovadoEm },
    { rotulo: "Em execução", data: null },
    { rotulo: "Concluída", data: os.dataConclusao },
    { rotulo: "Entregue", data: os.dataEntrega },
  ];
  // Etapa em que a OS esta agora (as anteriores ficam com check).
  // Entregue e o fim: todas ficam concluidas.
  const feitas = { aberta: os.aprovada ? 1 : 0, execucao: 2, concluida: 3, entregue: 5 }[fase];

  return (
    <ol className="mb-4 grid grid-cols-5 gap-1" aria-label="Andamento da OS">
      {etapas.map((e, i) => {
        const feita = i < feitas;
        const atual = i === feitas;
        return (
          <li key={e.rotulo} className="flex min-w-0 flex-col items-center text-center" aria-current={atual ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "invisible" : feita || atual ? "bg-primaria" : "bg-borda"}`} />
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  feita
                    ? "border-primaria bg-primaria text-fundo"
                    : atual
                      ? "border-primaria text-primaria"
                      : "border-borda text-suave"
                }`}
              >
                {feita ? <Icone.check tamanho={14} /> : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === etapas.length - 1 ? "invisible" : feita && i + 1 < feitas + 1 ? "bg-primaria" : "bg-borda"}`} />
            </div>
            <span className={`mt-1 text-[11px] leading-tight sm:text-xs ${feita || atual ? "text-texto" : "text-suave"}`}>{e.rotulo}</span>
            {(feita || atual) && e.data && <span className="hidden text-[10px] text-suave sm:block">{formatarData(e.data)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
