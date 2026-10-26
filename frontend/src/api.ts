// Comunicacao com a API do back-end.
// Toda chamada passa por aqui: coloca o token, converte o JSON e trata erros.

const CHAVE_TOKEN = "flexserv.token";

export const EVENTO_SESSAO_EXPIRADA = "flexserv:sessao-expirada";

export class ErroApi extends Error {
  status: number;
  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.status = status;
  }
}

export function lerToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

export function salvarToken(token: string | null) {
  if (token) localStorage.setItem(CHAVE_TOKEN, token);
  else localStorage.removeItem(CHAVE_TOKEN);
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function api<T>(caminho: string, metodo: Metodo = "GET", corpo?: unknown): Promise<T> {
  const token = lerToken();

  let resposta: Response;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi("Não foi possível conectar ao servidor.", 0);
  }

  // 204 = deu certo e nao tem conteudo (ex: exclusao)
  if (resposta.status === 204) return undefined as T;

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    // Token vencido ou invalido: avisa o app pra voltar ao login
    if (resposta.status === 401 && token) {
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA));
    }
    throw new ErroApi(dados?.erro ?? "Erro inesperado.", resposta.status);
  }

  return dados as T;
}

export function mensagemDeErro(err: unknown) {
  return err instanceof Error ? err.message : "Erro inesperado.";
}
