import { useState } from "react";
import { formatarDataHora } from "../formatar";
import type { Aviso } from "../types";
import { Icone } from "./Icones";
import { AreaTexto, Aviso as Alerta, Botao, Modal } from "./ui";

// Avisos pelo WhatsApp sem API paga: o botao abre o WhatsApp (link wa.me)
// com o numero do cliente e a mensagem pronta. Depois de enviar, a pessoa
// confirma em "Ja avisei" e o sistema registra quem avisou e quando.

// "(48) 99911-2233" -> "5548999112233" (acrescenta o 55 do Brasil)
export function numeroWhatsApp(telefone: string | null) {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  return digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
}

export function linkWhatsApp(telefone: string, mensagem: string) {
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}

export function BotaoWhatsApp({
  telefone,
  modelos,
  aoConfirmar,
  pequeno = false,
}: {
  telefone: string | null;
  modelos: { rotulo: string; texto: string }[];
  aoConfirmar: (mensagem: string) => Promise<unknown>;
  pequeno?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState(modelos[0]?.texto ?? "");
  const [abriuWhats, setAbriuWhats] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const numero = numeroWhatsApp(telefone);

  function abrir() {
    setMensagem(modelos[0]?.texto ?? "");
    setAbriuWhats(false);
    setErro("");
    setAberto(true);
  }

  async function confirmar() {
    setSalvando(true);
    setErro("");
    try {
      await aoConfirmar(mensagem);
      setAberto(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao registrar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Botao variante="whatsapp" pequeno={pequeno} onClick={abrir}>
        <Icone.whatsapp tamanho={18} /> WhatsApp
      </Botao>

      <Modal titulo="Avisar o cliente pelo WhatsApp" aberto={aberto} aoFechar={() => setAberto(false)}>
        {!numero ? (
          <Alerta>O cliente não tem um telefone válido no cadastro. Atualize o cadastro para usar o WhatsApp.</Alerta>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {modelos.map((m) => (
                <button
                  key={m.rotulo}
                  type="button"
                  onClick={() => setMensagem(m.texto)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    mensagem === m.texto ? "border-primaria bg-primaria/15 text-primaria" : "border-borda text-suave"
                  }`}
                >
                  {m.rotulo}
                </button>
              ))}
            </div>
            <AreaTexto rotulo="Mensagem" rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />

            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-xs font-bold">1</span>
                <a
                  href={linkWhatsApp(numero, mensagem)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setAbriuWhats(true)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 font-semibold text-[#06281a]"
                >
                  <Icone.whatsapp tamanho={18} /> Abrir WhatsApp e enviar
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-xs font-bold">2</span>
                <Botao onClick={confirmar} disabled={salvando || !mensagem.trim()} variante={abriuWhats ? "primario" : "secundario"} className="flex-1">
                  <Icone.check tamanho={18} /> {salvando ? "Registrando..." : "Já avisei"}
                </Botao>
              </li>
            </ol>
            <p className="text-xs text-suave">
              O "Já avisei" registra no histórico quem avisou o cliente, quando e com qual mensagem.
            </p>
            {erro && <Alerta>{erro}</Alerta>}
          </div>
        )}
      </Modal>
    </>
  );
}

// Historico de avisos ("ja avisei")
export function HistoricoAvisos({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) return <p className="text-sm text-suave">Nenhum aviso registrado.</p>;
  return (
    <ul className="space-y-3">
      {avisos.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#25d366]/15 text-[#25d366]">
            <Icone.check tamanho={14} />
          </span>
          <div className="min-w-0">
            <p className="text-suave">
              <b className="text-texto">{a.vendedor}</b> avisou em {formatarDataHora(a.criadoEm)}
            </p>
            <p className="mt-0.5 whitespace-pre-line break-words">{a.mensagem}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
