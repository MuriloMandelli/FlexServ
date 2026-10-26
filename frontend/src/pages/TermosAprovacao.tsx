import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, mensagemDeErro } from "../api";
import { AreaTexto, Aviso, Botao, CabecalhoPagina, Carregando, Cartao } from "../components/ui";

type Termos = { texto: string; padrao: string };

// Gestor edita o texto que cliente e tecnico aceitam ao aprovar uma OS
export default function TermosAprovacao() {
  const [termos, setTermos] = useState<Termos | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api<Termos>("/configuracoes/termos")
      .then((t) => {
        setTermos(t);
        setTexto(t.texto);
      })
      .catch((err) => setErro(mensagemDeErro(err)));
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setMensagem("");
    setSalvando(true);
    try {
      const t = await api<Termos>("/configuracoes/termos", "PUT", { texto });
      setTermos(t);
      setMensagem("Termos salvos. Valem para as próximas aprovações enviadas.");
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        titulo="Termos de aprovação"
        subtitulo="Texto que o cliente e o técnico leem e aceitam ao assinar uma OS"
        voltarPara="/os"
        voltarRotulo="Ordens de serviço"
      />

      {!termos && !erro && <Carregando />}
      {termos && (
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Cartao className="flex flex-col gap-3 p-4 sm:p-5">
            <AreaTexto rotulo="Termos" rows={16} value={texto} onChange={(e) => setTexto(e.target.value)} />
            <p className="text-xs text-suave">
              OS que já foram enviadas para aprovação guardam o texto da época. A mudança vale para os próximos envios.
            </p>
          </Cartao>
          {erro && <Aviso>{erro}</Aviso>}
          {mensagem && <Aviso tipo="sucesso">{mensagem}</Aviso>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Botao
              variante="fantasma"
              onClick={() => confirm("Voltar ao texto padrão? (só é salvo ao clicar em Salvar)") && setTexto(termos.padrao)}
            >
              Restaurar texto padrão
            </Botao>
            <Botao type="submit" disabled={salvando || texto === termos.texto}>
              {salvando ? "Salvando..." : "Salvar termos"}
            </Botao>
          </div>
        </form>
      )}
      {!termos && erro && <Aviso>{erro}</Aviso>}
    </div>
  );
}
