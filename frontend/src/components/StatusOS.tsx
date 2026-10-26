import { CORES_STATUS } from "../formatar";
import type { CorStatus, PagamentoStatus } from "../types";

// Selo colorido de status (os status sao configuraveis: nome e cor vem da API)
export function SeloStatus({ nome, cor }: { nome: string; cor: CorStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${CORES_STATUS[cor]?.selo ?? CORES_STATUS.cinza.selo}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {nome}
    </span>
  );
}

export function SeloPagamento({ status }: { status: PagamentoStatus }) {
  return status === "pago" ? (
    <SeloStatus nome="Pago" cor="verde" />
  ) : (
    <SeloStatus nome="A receber" cor="laranja" />
  );
}
