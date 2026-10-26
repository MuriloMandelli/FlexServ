import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, mensagemDeErro } from "../api";
import { CORES_STATUS, ROTULO_FASE } from "../formatar";
import type { CorStatus, Fase, StatusOS } from "../types";
import { SeloStatus } from "../components/StatusOS";
import { Icone } from "../components/Icones";
import { Aviso, Botao, CabecalhoPagina, Campo, CampoSelecao, Carregando, Cartao, Modal } from "../components/ui";

const FASES = Object.keys(ROTULO_FASE) as Fase[];
const CORES = Object.keys(CORES_STATUS) as CorStatus[];

const EXPLICACAO_FASE: Record<Fase, string> = {
  aberta: "OS criada, aguardando a aprovação (assinatura) do cliente. Itens e valores podem mudar.",
  execucao: "Serviço aprovado e em trabalho. Ainda dá para lançar peças extras.",
  concluida: "Serviço pronto. Os itens ficam travados.",
  entregue: "Máquina devolvida. A OS vira histórico e não muda mais.",
  cancelada: "OS cancelada. Não muda mais.",
};

type Formulario = { nome: string; cor: CorStatus; fase: Fase; ordem: number; padrao: boolean; ativo: boolean };
const VAZIO: Formulario = { nome: "", cor: "azul", fase: "execucao", ordem: 10, padrao: false, ativo: true };

export default function GerenciarStatus() {
  const [lista, setLista] = useState<StatusOS[] | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<StatusOS | "novo" | null>(null);
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");

  const carregar = useCallback(() => {
    api<StatusOS[]>("/status")
      .then(setLista)
      .catch((err) => setErro(mensagemDeErro(err)));
  }, []);
  useEffect(carregar, [carregar]);

  function abrir(s: StatusOS | "novo") {
    setErroForm("");
    setEditando(s);
    setForm(
      s === "novo"
        ? { ...VAZIO, ordem: (lista?.reduce((m, x) => Math.max(m, x.ordem), 0) ?? 0) + 1 }
        : { nome: s.nome, cor: s.cor, fase: s.fase, ordem: s.ordem, padrao: s.padrao, ativo: s.ativo }
    );
  }
  const fechar = useCallback(() => setEditando(null), []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      if (editando === "novo") await api("/status", "POST", form);
      else if (editando) await api(`/status/${editando.id}`, "PUT", form);
      setEditando(null);
      carregar();
    } catch (err) {
      setErroForm(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!editando || editando === "novo") return;
    if (!confirm(`Excluir o status "${editando.nome}"?`)) return;
    try {
      await api(`/status/${editando.id}`, "DELETE");
      setEditando(null);
      carregar();
    } catch (err) {
      setErroForm(mensagemDeErro(err));
    }
  }

  const emUso = editando !== "novo" && editando !== null && editando.quantidadeOs > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        titulo="Status de OS"
        subtitulo="Personalize as etapas que a sua assistência usa"
        voltarPara="/os"
        voltarRotulo="Ordens de serviço"
        acao={
          <Botao onClick={() => abrir("novo")}>
            <Icone.mais_sinal tamanho={18} /> Novo status
          </Botao>
        }
      />

      <Aviso tipo="info">
        Cada status pertence a uma <b>fase</b>. A fase é o que o sistema usa para as regras: aprovação, travar itens,
        datas e relatórios. Assim vocês podem criar etapas próprias, como "Aguardando orçamento" ou "Em teste", sem
        quebrar o fluxo.
      </Aviso>

      {erro && <Aviso>{erro}</Aviso>}
      {!lista && !erro && <Carregando />}

      {lista && (
        <div className="mt-5 flex flex-col gap-5">
          {FASES.map((fase) => {
            const daFase = lista.filter((s) => s.fase === fase);
            return (
              <div key={fase}>
                <p className="mb-1 text-sm font-semibold">{ROTULO_FASE[fase]}</p>
                <p className="mb-2 text-xs text-suave">{EXPLICACAO_FASE[fase]}</p>
                <Cartao className="divide-y divide-borda overflow-hidden">
                  {daFase.length === 0 && <p className="px-4 py-3 text-sm text-suave">Nenhum status nesta fase.</p>}
                  {daFase.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => abrir(s)}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-superficie-2"
                    >
                      <SeloStatus nome={s.nome} cor={s.cor} />
                      <span className="flex flex-1 flex-wrap gap-1.5">
                        {s.padrao && (
                          <span className="rounded-full bg-primaria/15 px-2 py-0.5 text-xs text-primaria">padrão de novas OS</span>
                        )}
                        {!s.ativo && <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs text-suave">desativado</span>}
                      </span>
                      <span className="text-xs text-suave">{s.quantidadeOs} OS</span>
                      <Icone.seta tamanho={16} />
                    </button>
                  ))}
                </Cartao>
              </div>
            );
          })}
        </div>
      )}

      <Modal titulo={editando === "novo" ? "Novo status" : "Editar status"} aberto={editando !== null} aoFechar={fechar}>
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Campo rotulo="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={40} required />

          <div>
            <span className="text-sm font-medium">Cor</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, cor: c })}
                  title={CORES_STATUS[c].rotulo}
                  className={`h-9 w-9 rounded-full border-2 ${form.cor === c ? "border-texto" : "border-transparent"}`}
                  style={{ backgroundColor: CORES_STATUS[c].hex }}
                />
              ))}
            </div>
          </div>

          <CampoSelecao
            rotulo="Fase *"
            value={form.fase}
            onChange={(e) => setForm({ ...form, fase: e.target.value as Fase })}
            disabled={emUso}
          >
            {FASES.map((f) => (
              <option key={f} value={f}>
                {ROTULO_FASE[f]}
              </option>
            ))}
          </CampoSelecao>
          {emUso && <p className="-mt-2 text-xs text-suave">A fase não pode mudar porque já existem OS com este status.</p>}

          <Campo
            rotulo="Ordem"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.ordem}
            onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
            dica="Define a ordem em que o status aparece nas listas."
          />

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[#5ab4ea]" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativo (aparece para escolher nas OS)
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[#5ab4ea]" checked={form.padrao} onChange={(e) => setForm({ ...form, padrao: e.target.checked })} />
            Status padrão de toda OS nova (precisa ser da fase Aberta)
          </label>

          {erroForm && <Aviso>{erroForm}</Aviso>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {editando !== "novo" && editando !== null ? (
              <Botao variante="perigo" onClick={excluir} disabled={emUso} title={emUso ? "Em uso: desative em vez de excluir" : undefined}>
                Excluir
              </Botao>
            ) : (
              <span />
            )}
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Botao>
          </div>
        </form>
      </Modal>
    </div>
  );
}
