# MiniAgil

Monorepo com:

- `backend`: API Express + Prisma + MySQL
- `frontend`: Next.js App Router

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- npm

## Variáveis de ambiente

- Backend: copie `backend/.env.example` para `backend/.env`
- Frontend: copie `frontend/.env.example` para `frontend/.env.local`

## Subindo infraestrutura local

Na raiz:

```bash
docker compose up -d
```

Serviços padrão:

- MySQL: `localhost:3307`
- Redis: `localhost:6379`
- MinIO API: `localhost:9000`
- MinIO Console: `localhost:9001`

## Rodando o backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

API padrão: `http://localhost:4000`

## Rodando o frontend

```bash
cd frontend
npm install
npm run dev
```

App padrão: `http://localhost:3000`

## Testes

Backend:

```bash
cd backend
npm test
```

Frontend (validação):

```bash
cd frontend
npm run lint
npm run build
```

## Troubleshooting

- `JWT_SECRET environment variable is required`: configure `backend/.env`.
- Erro de conexão com banco: confirme `docker compose up -d` e `DATABASE_URL`.
- Build do frontend com warning de lockfile: é apenas aviso de root detectado pelo Next.js.
