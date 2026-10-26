import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { formatarData, formatarMoeda, ROTULO_TIPO_EQUIPAMENTO } from "../formatar";
import type { Equipamento, OSResumo } from "../types";
import { FormMaquina } from "./Seletores";
import { SeloStatus } from "./StatusOS";
import { Aviso, Botao, Cartao } from "./ui";

// Tela de edicao do cliente: historico de OS + maquinas cadastradas.
// A OS nao exige maquina (a maioria dos servicos envolve varias), entao o
// historico e do cliente; as maquinas ficam como cadastro de referencia.
export function MaquinasCliente({ clienteId }: { clienteId: number }) {
  const [maquinas, setMaquinas] = useState<Equipamento[]>([]);
  const [ordens, setOrdens] = useState<OSResumo[]>([]);
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([
      api<Equipamento[]>(`/clientes/${clienteId}/equipamentos`),
      api<OSResumo[]>(`/os?clienteId=${clienteId}`),
    ])
      .then(([m, o]) => {
        setMaquinas(m);
        setOrdens(o);
      })
      .catch((err) => setErro(mensagemDeErro(err)));
  }, [clienteId]);

  async function excluir(m: Equipamento) {
    if (!confirm(`Excluir a máquina ${m.marca} ${m.modelo}?`)) return;
    setErro("");
    try {
      await api(`/equipamentos/${m.id}`, "DELETE");
      setMaquinas((atual) => atual.filter((x) => x.id !== m.id));
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <>
      <Cartao className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Histórico de OS</h2>
          <Link to="/os/nova" className="text-sm text-primaria">
            + Nova OS
          </Link>
        </div>
        {ordens.length === 0 ? (
          <p className="text-sm text-suave">Nenhuma OS para este cliente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda">
            {ordens.map((o) => (
              <li key={o.id}>
                <Link to={`/os/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="text-suave">#{o.id}</span> {formatarData(o.dataAbertura)}
                    {o.defeitoRelatado && <span className="block truncate text-xs text-suave">{o.defeitoRelatado}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <SeloStatus nome={o.status.nome} cor={o.status.cor} />
                    <span className="tabular-nums">{formatarMoeda(o.valorTotal)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Máquinas do cliente</h2>
          {!adicionando && (
            <Botao type="button" variante="secundario" onClick={() => setAdicionando(true)}>
              + Máquina
            </Botao>
          )}
        </div>

        {adicionando && (
          <div className="mb-3">
            <FormMaquina
              clienteId={clienteId}
              aoSalvar={(nova) => {
                setMaquinas((atual) => [...atual, nova]);
                setAdicionando(false);
              }}
              aoCancelar={() => setAdicionando(false)}
            />
          </div>
        )}

        {erro && <Aviso>{erro}</Aviso>}
        {maquinas.length === 0 && !adicionando && <p className="text-sm text-suave">Nenhuma máquina cadastrada.</p>}

        <ul className="flex flex-col gap-2">
          {maquinas.map((m) => {
            // Maquinas ligadas a OS antigas nao podem ser excluidas
            const emUso = ordens.some((o) => o.equipamentoId === m.id);
            return (
              <li key={m.id} className="flex items-start justify-between gap-2 rounded-xl border border-borda p-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {m.marca} {m.modelo}
                  </p>
                  <p className="text-xs text-suave">
                    {ROTULO_TIPO_EQUIPAMENTO[m.tipo]}
                    {m.numeroSerie ? ` · Série ${m.numeroSerie}` : ""}
                  </p>
                </div>
                {!emUso && (
                  <button type="button" onClick={() => excluir(m)} className="text-sm text-suave hover:text-perigo">
                    Excluir
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Cartao>
    </>
  );
}
