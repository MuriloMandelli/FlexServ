import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, EVENTO_SESSAO_EXPIRADA, lerToken, salvarToken } from "./api";
import type { Usuario } from "./types";

// Guarda quem esta logado e disponibiliza para todas as telas

const CHAVE_USUARIO = "flexserv.usuario";

type ContextoAuth = {
  usuario: Usuario | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
};

const AuthContext = createContext<ContextoAuth | null>(null);

function lerUsuarioSalvo(): Usuario | null {
  if (!lerToken()) return null;
  try {
    return JSON.parse(localStorage.getItem(CHAVE_USUARIO) ?? "null");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(lerUsuarioSalvo);

  const sair = useCallback(() => {
    salvarToken(null);
    localStorage.removeItem(CHAVE_USUARIO);
    setUsuario(null);
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await api<{ token: string; usuario: Usuario }>("/login", "POST", {
      email,
      senha,
    });
    salvarToken(resposta.token);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(resposta.usuario));
    setUsuario(resposta.usuario);
  }, []);

  // Se qualquer chamada voltar 401 (token vencido), desloga
  useEffect(() => {
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, sair);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, sair);
  }, [sair]);

  return <AuthContext.Provider value={{ usuario, entrar, sair }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth precisa estar dentro do AuthProvider");
  return contexto;
}

// Envolve as telas que exigem login. Opcionalmente exige papel de gestor.
export function RotaProtegida({ children, apenasGestor = false }: { children: ReactNode; apenasGestor?: boolean }) {
  const { usuario } = useAuth();
  const local = useLocation();

  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  if (apenasGestor && usuario.papel !== "gestor") return <Navigate to="/" replace />;
  return <>{children}</>;
}
