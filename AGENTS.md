# AGENTS.md — MiniAgil

## Projeto

MiniAgil é uma aplicação de gestão ágil com backlog hierárquico:

Sistema/Projeto > Épico > História de Usuário > Atividade

O objetivo é evoluir o sistema para uma ferramenta própria de requisitos, backlog, Kanban, sprint, documentação funcional, integração com n8n e geração de prompts para Codex.

## Stack

Backend:
- Node.js
- Express
- TypeScript
- Prisma
- MySQL
- JWT

Frontend:
- Next.js
- TypeScript
- React Query
- Tailwind/shadcn se já estiver configurado

Infra:
- Docker Compose
- MySQL
- Redis
- MinIO

## Regras gerais

- Não alterar arquitetura sem necessidade.
- Não reescrever módulos inteiros se uma alteração incremental resolver.
- Cada task deve afetar poucos arquivos.
- Cada alteração deve ser testável isoladamente.
- Manter compatibilidade com MySQL.
- Usar Prisma migrations quando alterar o schema.
- Não remover funcionalidades existentes.
- Não mudar contratos de API sem atualizar frontend correspondente.
- Não expor secrets no código.
- Preferir nomes em inglês no código e labels em português na interface.

## Convenções

- Backend em `backend/src/modules`.
- Cada módulo deve ter controller, routes e validações quando necessário.
- Usar `authMiddleware` nas rotas protegidas.
- Validar se o usuário pertence ao projeto antes de permitir alterações.
- Frontend deve consumir API por `frontend/src/lib/api/client.ts`.
- Usar `NEXT_PUBLIC_API_URL` no frontend.
- Usar `FRONTEND_URL` no backend para links externos.

## Comandos esperados

Backend:
- npm install
- npx prisma generate
- npx prisma migrate dev
- npm run dev
- npm run build

Frontend:
- npm install
- npm run dev
- npm run build

## Critérios de qualidade

- Código compila.
- Rotas existentes continuam funcionando.
- Erros devem retornar mensagens claras.
- Alterações de banco devem ter migration.
- Cada task deve terminar com resumo do que mudou e como testar.
