# MiniAgil Backend

API REST do MiniAgil em Express + Prisma.

## Pré-requisitos

- Node.js 20+
- MySQL em `localhost:3307` (via `docker compose`)

## Configuração

1. Copie `.env.example` para `.env`.
2. Instale dependências:

```bash
npm install
```

3. Gere o client Prisma e aplique migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

## Scripts

- `npm run dev`: sobe em modo desenvolvimento (`tsx watch`)
- `npm run build`: compila TypeScript
- `npm run start`: executa build em `dist`
- `npm test`: roda suíte Vitest (inclui cenário e2e de fluxo login -> itens)

## Variáveis de ambiente

Veja `./.env.example`.

## Testes implementados

Arquivo: `tests/api.test.ts`

- Login
- Listagem de itens
- Criação de item
- Atualização de status de sprint
- Gestão básica de usuários (listagem)
- E2E: login seguido de listagem de itens

## Troubleshooting

- `JWT_SECRET environment variable is required`: adicione `JWT_SECRET` no `.env`.
- `P1001`/erro de conexão Prisma: verifique MySQL e `DATABASE_URL`.
