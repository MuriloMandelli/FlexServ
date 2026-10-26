import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { useAuth } from "../auth";
import type { Loja, Papel, Vendedor } from "../types";
import { Aviso, Botao, CabecalhoPagina, Campo, CampoSelecao, CampoSenha, Carregando, Cartao } from "../components/ui";

export default function VendedorForm() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const editando = id !== undefined;
  // O gestor nao pode mudar o proprio papel nem se excluir (o back-end tambem bloqueia)
  const ehEuMesmo = editando && Number(id) === usuario?.id;
  const navegar = useNavigate();

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>("vendedor");
  const [lojaId, setLojaId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const buscas: [Promise<Loja[]>, Promise<Vendedor | null>] = [
      api<Loja[]>("/lojas"),
      editando ? api<Vendedor>(`/vendedores/${id}`) : Promise.resolve(null),
    ];
    Promise.all(buscas)
      .then(([listaLojas, v]) => {
        setLojas(listaLojas);
        if (v) {
          setNome(v.nome);
          setEmail(v.email);
          setTelefone(v.telefone ?? "");
          setPapel(v.papel);
          setLojaId(String(v.lojaId));
        } else if (listaLojas.length === 1) {
          setLojaId(String(listaLojas[0].id));
        }
      })
      .catch((err) => setErro(mensagemDeErro(err)))
      .finally(() => setCarregando(false));
  }, [editando, id]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const dados = { nome, email, telefone, papel, lojaId: Number(lojaId), senha };
      if (editando) await api(`/vendedores/${id}`, "PUT", dados);
      else await api("/vendedores", "POST", dados);
      navegar("/vendedores");
    } catch (err) {
      setErro(mensagemDeErro(err));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!confirm(`Excluir o vendedor "${nome}"?`)) return;
    setErro("");
    try {
      await api(`/vendedores/${id}`, "DELETE");
      navegar("/vendedores");
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina
        titulo={editando ? "Editar vendedor" : "Novo vendedor"}
        voltarPara="/vendedores"
        voltarRotulo="Vendedores"
      />

      {carregando ? (
        <Carregando />
      ) : (
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Cartao className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Campo
              rotulo="Nome *"
              className="sm:col-span-2"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <Campo
              rotulo="E-mail *"
              type="email"
              inputMode="email"
              autoComplete="off"
              className="sm:col-span-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Campo
              rotulo="WhatsApp"
              type="tel"
              inputMode="tel"
              className="sm:col-span-2"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(48) 99999-9999"
              dica="Usado para enviar ao técnico o link de aprovação das OS."
            />
            <CampoSenha
              rotulo={editando ? "Nova senha" : "Senha *"}
              autoComplete="new-password"
              className="sm:col-span-2"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required={!editando}
              minLength={6}
              dica={editando ? "Deixe em branco para manter a senha atual." : "Mínimo de 6 caracteres."}
            />
            <CampoSelecao
              rotulo="Papel *"
              value={papel}
              onChange={(e) => setPapel(e.target.value as Papel)}
              disabled={ehEuMesmo}
            >
              <option value="vendedor">Vendedor</option>
              <option value="gestor">Gestor</option>
            </CampoSelecao>
            <CampoSelecao rotulo="Loja *" value={lojaId} onChange={(e) => setLojaId(e.target.value)} required>
              <option value="" disabled>
                Selecione
              </option>
              {lojas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </CampoSelecao>
          </Cartao>

          {erro && <Aviso>{erro}</Aviso>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {editando && !ehEuMesmo ? (
              <Botao type="button" variante="perigo" onClick={excluir}>
                Excluir
              </Botao>
            ) : (
              <span />
            )}
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar vendedor"}
            </Botao>
          </div>
        </form>
      )}
    </div>
  );
}
