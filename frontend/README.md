# MiniAgil Frontend

Aplicação Next.js App Router do MiniAgil.

## Pré-requisitos

- Node.js 20+
- Backend rodando em `http://localhost:4000` (ou URL configurada em env)

## Configuração

1. Copie `.env.example` para `.env.local`
2. Instale dependências:

```bash
npm install
```

## Scripts

- `npm run dev`: ambiente local
- `npm run lint`: lint
- `npm run build`: build de produção
- `npm run start`: serve build

## Variáveis de ambiente

- `NEXT_PUBLIC_API_URL`: URL base da API (ex.: `http://localhost:4000`)

## Arquitetura de dados

- Client HTTP centralizado em `src/lib/api/client.ts`
- Módulos de domínio em `src/lib/api/*`
- Sessão/Auth centralizados em `src/lib/auth/AuthContext.tsx`
- Cache/revalidação com React Query (`src/app/providers.tsx`, `src/lib/query/keys.ts`)

## Troubleshooting

- Se o login falhar por conexão: confirme backend ativo e `NEXT_PUBLIC_API_URL`.
- Warning de lockfile no build: não bloqueia execução local.
