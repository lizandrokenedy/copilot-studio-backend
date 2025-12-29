# Configuracao do ambiente

Este documento descreve as variaveis de ambiente, arquivos esperados e o fluxo de execucao local via Docker.

## Variaveis de ambiente

- `PORT`: porta do servidor HTTP. Padrao `3000`.
- `DATABASE_URL`: string de conexao do MySQL usada pelo Prisma.
- `COPILOT_DIRECT_LINE_SECRET`: segredo do Direct Line do agente no Copilot Studio.
- `DIRECT_LINE_BASE_URL`: base URL do Direct Line (padrao `https://directline.botframework.com/v3/directline`).
- `JWT_SECRET`: segredo usado para assinar os tokens JWT.
- `JWT_EXPIRES_IN`: tempo de expiração do JWT (ex.: `7d`).

Exemplo:
```
PORT=3000
DATABASE_URL=mysql://copilot:copilot@localhost:3306/copilot
COPILOT_DIRECT_LINE_SECRET=
DIRECT_LINE_BASE_URL=https://directline.botframework.com/v3/directline
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
```

## Arquivos

- `.env`: arquivo local com as variaveis reais (nao deve ser versionado).
- `.env.example`: modelo do arquivo `.env`.

## Docker Compose (recomendado)

Arquivos:
- `docker-compose.yml`: sobe `db` (MySQL) e `api` (Node + Prisma).
- `Dockerfile`: build da API com TypeScript e Prisma.

Fluxo sugerido:
1. Copie `.env.example` para `.env` e ajuste os valores.
2. Suba o banco com `docker compose up -d db`.
3. Gere o client e rode a primeira migracao com `npm run db:migrate`.
4. Suba a API com `docker compose up --build`.

## MySQL fora do Docker Compose (WSL)

Comando para subir um MySQL isolado via Docker:
```bash
docker run -d --name copilot-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=copilot \
  -e MYSQL_USER=copilot \
  -e MYSQL_PASSWORD=copilot \
  -p 3306:3306 \
  -v copilot_mysql_data:/var/lib/mysql \
  mysql:8.0 --default-authentication-plugin=mysql_native_password
```

String de conexao correspondente:
```
DATABASE_URL=mysql://copilot:copilot@localhost:3306/copilot
```

## MySQL com docker-compose separado (com permissao para Prisma)

Arquivo: `docker-compose-mysql.yaml`

Este compose executa um script de inicializacao que concede permissao de `CREATE DATABASE`
para o usuario `copilot`, evitando o erro do Prisma ao criar o shadow database.

Subir o banco:
```bash
docker compose -f docker-compose-mysql.yaml up -d
```

Script SQL aplicado no startup:
`docker/mysql-init/001-grants.sql`

## Prisma

Comandos uteis:
- `npm run db:generate`: gera o client Prisma.
- `npm run db:migrate`: cria e aplica a migracao de desenvolvimento.
- `npm run db:deploy`: aplica migracoes em ambiente de deploy.

O schema Prisma esta em `prisma/schema.prisma`.

## Copilot Studio (Direct Line)

O backend usa o Direct Line Secret do agente para enviar e receber mensagens.
