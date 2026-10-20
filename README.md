# FlexServ
FlexServ é um sistema web para gestão de Ordens de Serviço da TecFlex (aparelhos para máquinas de costura industriais e domésticas), substituindo o controle em papel por um fluxo digital de abertura, acompanhamento e consulta de OS, vinculando clientes, vendedores, lojas e os itens/serviços de cada atendimento.

## Estrutura

```
backend/    API REST (Node.js + Express + TypeScript + Drizzle ORM + PostgreSQL/Neon)
frontend/   SPA (React + TypeScript + Vite + TailwindCSS)
```

## Rodando o projeto

São dois terminais, um para cada parte.

Back-end (API em http://localhost:3333):

```bash
cd backend
npm install
npm run dev
```

Antes da primeira execução, copie `backend/.env.example` para `backend/.env` e preencha `DATABASE_URL` e `JWT_SECRET` (o arquivo explica cada um). Para criar a loja e o usuário inicial: `npm run db:seed`.

Front-end (em http://localhost:5173):

```bash
cd frontend
npm install
npm run dev
```

O front chama a API por `/api/...` e o Vite repassa para a porta 3333 (proxy em `frontend/vite.config.ts`). Para testar no celular, use o endereço "Network" que o Vite mostra no terminal, com o celular no mesmo Wi-Fi.

## Rotas da API

Todas as rotas, exceto `/login` e `/health`, exigem o header `Authorization: Bearer <token>`.

| Método | Rota | Acesso |
|---|---|---|
| POST | `/login` | público |
| GET | `/health` | público |
| GET, POST | `/clientes` (`?busca=` filtra por nome ou CPF/CNPJ) | logado |
| GET, PUT, DELETE | `/clientes/:id` | logado |
| GET | `/lojas`, `/lojas/:id` | logado |
| POST, PUT, DELETE | `/lojas`, `/lojas/:id` | gestor |
| GET, POST, PUT, DELETE | `/vendedores`, `/vendedores/:id` | gestor |
| GET | `/itens` (`?busca=`, `?tipo=peca\|maquina\|mao_de_obra`), `/itens/:id` | logado |
| POST, PUT, DELETE | `/itens`, `/itens/:id` | gestor |
| GET, POST | `/clientes/:id/equipamentos` (máquinas do cliente) | logado |
| PUT, DELETE | `/equipamentos/:id` | logado |
| GET | `/status` (status configuráveis da OS) | logado |
| POST, PUT, DELETE | `/status`, `/status/:id` | gestor |
| GET | `/os` (`?statusId=`, `?fase=`, `?tipo=oficina\|campo`, `?pagamento=`, `?busca=`, `?clienteId=`, `?equipamentoId=`) | logado |
| POST | `/os` (abre a OS já com os itens, no status padrão) | logado |
| GET, PUT | `/os/:id` (detalhe / dados do atendimento) | logado |
| PUT | `/os/:id/pagamento` (desconto, forma e situação do pagamento) | logado |
| POST | `/os/:id/aprovar` (assinaturas do cliente e do técnico) | logado |
| PATCH | `/os/:id/status` (`{ statusId }`) | logado |
| POST | `/os/:id/itens`, `/os/:id/avisos` | logado |
| PUT, DELETE | `/os/:id/itens/:itemOsId` | logado |
| GET, POST | `/vendas` (`?busca=`, `?status=`, `?pagamento=`) | logado |
| GET | `/vendas/:id` | logado |
| PUT, PATCH, POST | `/vendas/:id/pagamento`, `/vendas/:id/cancelar`, `/vendas/:id/avisos` | logado |
| GET | `/relatorios` (`?de=AAAA-MM-DD&ate=AAAA-MM-DD`) | logado |

### Serviços (OS) x Vendas

- **Serviços:** ordens de manutenção, na oficina ou em campo (no cliente, com endereço e data da visita).
- **Vendas:** venda de peças e máquinas no balcão, sem OS. Mão de obra não entra em venda.

### Regras da OS

- Os status são configuráveis (nome, cor, ordem), mas cada um pertence a uma **fase** fixa: `aberta`, `execucao`, `concluida`, `entregue` ou `cancelada`. As regras olham a fase (`backend/src/services/os.ts`).
- A OS só sai da fase aberta depois de **aprovada**: cliente e técnico assinam na tela. Se os itens ou o desconto mudarem antes de iniciar, a aprovação cai e é preciso assinar de novo.
- O valor é sempre calculado pelo back-end: itens (quantidade x preço congelado) menos o desconto.
- O preço (e o custo) do item fica congelado na OS: mudar o cadastro não altera OS antigas.
- Itens só mudam nas fases aberta e em execução. Não é possível concluir sem itens nem entregar sem concluir. Entregue e cancelada são finais.
- Avisos ao cliente pelo WhatsApp usam o link `wa.me` (sem API paga) e ficam registrados com o "Já avisei".

## Dados de demonstração

Depois do `npm run db:seed` (loja e usuário de teste), rode na pasta `backend`:

```bash
npm run db:seed-demo
```

Cria peças, máquinas, clientes, OS e vendas fictícias dos últimos 6 meses (só roda se não houver itens). Para apagar e recriar tudo: `npm run db:seed-demo -- --recriar`.

Erros sempre voltam no formato `{ "erro": "mensagem" }`.
