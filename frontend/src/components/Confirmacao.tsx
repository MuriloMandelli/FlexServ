import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Botao, Modal } from "./ui";

// Janela de confirmacao no visual do sistema (no lugar do confirm() do
// navegador, que mostra "tecflex.vercel.app diz..." com cara de aviso externo).
//   const confirmar = useConfirmar();
//   if (!(await confirmar({ titulo: "Excluir item?", mensagem: "...", perigo: true }))) return;

type Pedido = {
  titulo: string;
  mensagem?: ReactNode;
  confirmar?: string; // texto do botao (padrao "Confirmar")
  cancelar?: string;
  perigo?: boolean; // botao vermelho (excluir, cancelar...)
};

const ConfirmacaoContext = createContext<((p: Pedido) => Promise<boolean>) | null>(null);

export function ConfirmacaoProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const resposta = useRef<(ok: boolean) => void>(() => {});

  const confirmar = useCallback(
    (p: Pedido) =>
      new Promise<boolean>((resolver) => {
        resposta.current = resolver;
        setPedido(p);
      }),
    []
  );

  const responder = useCallback((ok: boolean) => {
    resposta.current(ok);
    setPedido(null);
  }, []);

  return (
    <ConfirmacaoContext.Provider value={confirmar}>
      {children}
      <Modal titulo={pedido?.titulo ?? ""} aberto={pedido !== null} aoFechar={() => responder(false)} largura="max-w-md">
        {pedido?.mensagem && <p className="text-sm text-suave">{pedido.mensagem}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao type="button" variante="secundario" onClick={() => responder(false)}>
            {pedido?.cancelar ?? "Voltar"}
          </Botao>
          <Botao type="button" variante={pedido?.perigo ? "perigo" : "primario"} onClick={() => responder(true)} autoFocus>
            {pedido?.confirmar ?? "Confirmar"}
          </Botao>
        </div>
      </Modal>
    </ConfirmacaoContext.Provider>
  );
}

export function useConfirmar() {
  const confirmar = useContext(ConfirmacaoContext);
  if (!confirmar) throw new Error("useConfirmar precisa estar dentro do ConfirmacaoProvider");
  return confirmar;
}
