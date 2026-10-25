# FlexServ
FlexServ é um sistema web para gestão de Ordens de Serviço da TecFlex (aparelhos para máquinas de costura industriais e domésticas), substituindo o controle em papel por um fluxo digital de abertura, acompanhamento e consulta de OS, vinculando clientes, vendedores, lojas e os itens/serviços de cada atendimento.

- **Sistema:** https://tecflex.vercel.app
- **API:** https://flexserv-api.vercel.app
- **Documentação técnica completa (PDF):** [docs/FlexServ-Documentacao-Tecnica.pdf](docs/FlexServ-Documentacao-Tecnica.pdf)

## Arquitetura

SPA + API REST. O front-end em React roda no navegador e cuida só da interface; a API em Express valida os dados, aplica as regras de negócio e grava no PostgreSQL.

```
Navegador / celular (React)  --HTTP/JSON-->  API (Node + Express)  --SQL-->  PostgreSQL (Neon)
```

| Camada | Tecnologia |
|---|---|
| Front-end | React 19, TypeScript, Vite, Tailwind CSS v4, react-router, jspdf, recharts |
| Back-end | Node.js, Express, TypeScript, zod (validação), JWT + bcryptjs (login) |
| Banco | PostgreSQL 18 no Neon, Drizzle ORM / drizzle-kit |
| Hospedagem | Vercel (front e API em projetos separados) |

## Estrutura

```
backend/
  src/index.ts           ponto de entrada: cria o Express e registra as rotas
  src/db/index.ts        conexão com o banco (pool do Neon + Drizzle)
  src/db/schema.ts       definição das tabelas
  src/middleware/auth.ts autenticação JWT e permissão de gestor
  src/routes/            uma rota por assunto (clientes, os, vendas, relatorios...)
  src/services/os.ts     regras de negócio da OS e cálculo do total
  src/utils/             validação (zod) e tratamento de erros
  drizzle.config.ts      configuração do drizzle-kit (db:push)
frontend/
  src/api.ts             toda chamada à API (token, JSON, erros)
  src/auth.tsx           sessão do usuário e proteção das telas
  src/pages/             telas
  src/components/        componentes reutilizáveis
  src/pdf.ts             PDF da OS, da venda e das tabelas
```

### Conexão com o banco

1. `backend/.env` guarda a `DATABASE_URL` (não versionado; modelo em `backend/.env.example`).
2. `backend/src/db/index.ts` cria o pool de conexões e exporta o objeto `db`, usado por todas as rotas.
3. `backend/src/db/schema.ts` define as tabelas; `npm run db:push` aplica o schema no banco.

Tabelas: `loja`, `vendedor`, `cliente`, `equipamento`, `item`, `status_os`, `servico`, `servico_item`, `venda`, `venda_item`, `aviso_cliente`, `configuracao`.

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
| GET | `/equipe` (nomes da equipe, para escolher o técnico da OS) | logado |
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
| POST | `/os/:id/aprovacao` (gera os links de aprovação e congela os termos) | logado |
| POST | `/os/:id/aprovacao/tecnico` (técnico responsável assina no sistema) | técnico da OS |
| GET, POST | `/publico/aprovacao/:token` (página de aprovação aberta pelo link do WhatsApp) | público, com token |
| GET | `/configuracoes/termos` | logado |
| PUT | `/configuracoes/termos` (texto dos termos de aprovação) | gestor |
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
- A OS só sai da fase aberta depois de **aprovada** pelo cliente e pelo técnico responsável (assinatura eletrônica, ver abaixo). Se os itens ou o desconto mudarem antes de iniciar, a aprovação cai, os links antigos param de funcionar e é preciso assinar de novo.
- O técnico responsável pode ser diferente de quem abriu a OS (ex.: o atendimento abre e escolhe o técnico).
- A máquina é opcional: a maioria dos serviços envolve mais de uma máquina.
- O valor é sempre calculado pelo back-end: itens (quantidade x preço congelado) menos o desconto.
- O preço (e o custo) do item fica congelado na OS: mudar o cadastro não altera OS antigas.
- Itens de **valor variável** (mão de obra, transporte, combustível...) têm o preço informado na hora de lançar na OS ou na venda; o valor do cadastro é só sugestão. Itens de valor fixo sempre usam o preço do cadastro (o back-end ignora qualquer valor enviado pelo front). Uma OS com item variável sem valor não pode ser enviada para aprovação.
- O defeito relatado é opcional na abertura e pode ser preenchido depois.
- Em atendimento em campo, a previsão de entrega herda a data da visita (pode ser alterada).
- Itens só mudam nas fases aberta e em execução. Não é possível concluir sem itens nem entregar sem concluir. Entregue e cancelada são finais.
- Avisos ao cliente pelo WhatsApp usam o link `wa.me` (sem API paga) e ficam registrados com o "Já avisei".

### Aprovação eletrônica

1. Com os itens lançados, "Enviar para aprovação" gera dois links (um do cliente, um do técnico) e congela uma cópia dos termos na OS.
2. Os links vão pelo WhatsApp (`wa.me`). Quem abre vê o orçamento e os termos, marca "Li e concordo" e toca em "Assinar". Não precisa de login.
3. O técnico, se estiver logado, pode assinar direto na tela da OS.
4. Cada aceite guarda nome, data/hora, IP e aparelho. Com os dois aceites, a OS está aprovada e pode ser iniciada.
5. O link usa um token aleatório de 48 caracteres e mostra só o necessário (sem CPF, telefone ou endereço).

O texto dos termos é editado pelo gestor em **Termos de aprovação**.

## Dados de demonstração

Depois do `npm run db:seed` (loja e usuário de teste), rode na pasta `backend`:

```bash
npm run db:seed-demo
```

Cria peças, máquinas, clientes, OS e vendas fictícias dos últimos 6 meses (só roda se não houver itens). Para apagar e recriar tudo: `npm run db:seed-demo -- --recriar`.

Erros sempre voltam no formato `{ "erro": "mensagem" }`.

## Deploy

Front e API são dois projetos na Vercel. Para publicar uma alteração, rode `vercel --prod` dentro de `backend/` ou `frontend/`.

- `backend/vercel.json`: framework Express. A API roda como função serverless (o `index.ts` exporta o app e só abre a porta fora da Vercel).
- `frontend/vercel.json`: framework Vite. Repassa `/api/*` para a API e manda qualquer outra rota para o `index.html` (SPA).
- `DATABASE_URL` e `JWT_SECRET` ficam nas variáveis de ambiente da Vercel, nunca no código.

## Segurança

- Senhas com hash bcrypt; o hash nunca é devolvido pela API.
- Login com JWT (validade de 8h) assinado com `JWT_SECRET`.
- Links de aprovação com token aleatório, válidos só enquanto a OS aguarda aprovação.
- Rotas de gestão protegidas pelo middleware `apenasGestor`.
- Toda validação e cálculo de valores acontece no servidor; o front-end nunca envia o total.
- Segredos fora do Git (`.env` no `.gitignore`).
