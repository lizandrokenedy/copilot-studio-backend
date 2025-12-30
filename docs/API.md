# API - copilot-back

## Visao geral

API HTTP para backend do projeto copilot-back. Esta versao exp?e endpoints basicos para listar conversas e retornar um contexto resumido do usuario autenticado.

Base URL: `http://localhost:3000`

## Autenticacao

- Os endpoints protegidos exigem header `Authorization` no formato `Bearer <token>`.
- Obtenha o token via `POST /api/auth/register` ou `POST /api/auth/login`.
- Se `JWT_SECRET` nao estiver configurado, os endpoints protegidos retornam `503`.

## Endpoints

### GET /

Retorna informacoes basicas da API.

Requisitos:
- Nenhum header especial.

Resposta 200:
```json
{
  "name": "copilot-back",
  "version": "0.1.0"
}
```

### GET /health

Status de saude do servico.

Requisitos:
- Nenhum header especial.

Resposta 200:
```json
{
  "status": "ok"
}
```

### POST /api/auth/register

Cria um usuario e retorna um JWT.

Requisitos:
- Variavel `DATABASE_URL` configurada (veja `.env.example`)
- Variavel `JWT_SECRET` configurada (veja `.env.example`)

Body:
```json
{
  "email": "user@example.com",
  "password": "minhaSenha",
  "displayName": "Usuario"
}
```

Resposta 201:
```json
{
  "token": "<jwt>",
  "user": {
    "id": "<userId>",
    "email": "user@example.com",
    "displayName": "Usuario"
  }
}
```

Resposta 400 (email invalido):
```json
{
  "error": "Invalid email"
}
```

Resposta 400 (password invalida):
```json
{
  "error": "Invalid password"
}
```

Resposta 400 (displayName invalido):
```json
{
  "error": "Invalid displayName"
}
```

Resposta 409 (email ja cadastrado):
```json
{
  "error": "Email already registered"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 503 (quando `JWT_SECRET` nao esta configurado):
```json
{
  "error": "JWT_SECRET is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### POST /api/auth/login

Autentica um usuario existente e retorna um JWT.

Requisitos:
- Variavel `DATABASE_URL` configurada (veja `.env.example`)
- Variavel `JWT_SECRET` configurada (veja `.env.example`)

Body:
```json
{
  "email": "user@example.com",
  "password": "minhaSenha"
}
```

Resposta 200:
```json
{
  "token": "<jwt>",
  "user": {
    "id": "<userId>",
    "email": "user@example.com",
    "displayName": "Usuario"
  }
}
```

Resposta 400 (email invalido):
```json
{
  "error": "Invalid email"
}
```

Resposta 400 (password invalida):
```json
{
  "error": "Invalid password"
}
```

Resposta 401 (credenciais invalidas):
```json
{
  "error": "Invalid credentials"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 503 (quando `JWT_SECRET` nao esta configurado):
```json
{
  "error": "JWT_SECRET is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### GET /api/users/me

Recupera o usuario autenticado.

Requisitos:
- Header `Authorization: Bearer <token>`
- Variavel `DATABASE_URL` configurada (veja `.env.example`)

Resposta 200:
```json
{
  "user": {
    "id": "<userId>",
    "email": "user@example.com",
    "displayName": "Usuario",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

Resposta 401:
```json
{
  "error": "Missing bearer token"
}
```

Resposta 401 (token invalido):
```json
{
  "error": "Invalid token"
}
```

Resposta 401 (token vazio):
```json
{
  "error": "Empty bearer token"
}
```

Resposta 401 (quando o usuario nao foi carregado no request):
```json
{
  "error": "Missing user context"
}
```

Resposta 404:
```json
{
  "error": "User not found"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### PATCH /api/users/me

Atualiza dados do usuario autenticado.

Requisitos:
- Header `Authorization: Bearer <token>`
- Variavel `DATABASE_URL` configurada (veja `.env.example`)

Body (opcional):
```json
{
  "displayName": "Novo Nome"
}
```

Resposta 200:
```json
{
  "user": {
    "id": "<userId>",
    "email": "user@example.com",
    "displayName": "Novo Nome",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

Resposta 400 (displayName invalido):
```json
{
  "error": "Invalid displayName"
}
```

Resposta 401:
```json
{
  "error": "Missing bearer token"
}
```

Resposta 401 (token invalido):
```json
{
  "error": "Invalid token"
}
```

Resposta 401 (token vazio):
```json
{
  "error": "Empty bearer token"
}
```

Resposta 401 (quando o usuario nao foi carregado no request):
```json
{
  "error": "Missing user context"
}
```

Resposta 404:
```json
{
  "error": "User not found"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### DELETE /api/users/me

Remove o usuario autenticado e seus dados relacionados.

Requisitos:
- Header `Authorization: Bearer <token>`
- Variavel `DATABASE_URL` configurada (veja `.env.example`)

Resposta 204: sem conteudo.

Resposta 401:
```json
{
  "error": "Missing bearer token"
}
```

Resposta 401 (token invalido):
```json
{
  "error": "Invalid token"
}
```

Resposta 401 (token vazio):
```json
{
  "error": "Empty bearer token"
}
```

Resposta 401 (quando o usuario nao foi carregado no request):
```json
{
  "error": "Missing user context"
}
```

Resposta 404:
```json
{
  "error": "User not found"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### GET /api/conversations

Lista conversas do usuario autenticado.

Requisitos:
- Header `Authorization: Bearer <token>`
- Variavel `DATABASE_URL` configurada (veja `.env.example`)

Resposta 200:
```json
{
  "conversations": [
    {
      "id": "placeholder",
      "title": "Conversation for <userId>",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "source": "db"
}
```

Resposta 401:
```json
{
  "error": "Missing bearer token"
}
```

Resposta 401 (token invalido):
```json
{
  "error": "Invalid token"
}
```

Resposta 401 (token vazio):
```json
{
  "error": "Empty bearer token"
}
```

Resposta 401 (quando o usuario nao foi carregado no request):
```json
{
  "error": "Missing user context"
}
```

Resposta 404 (usuario nao encontrado):
```json
{
  "error": "User not found"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### POST /api/conversations

Cria uma nova conversa para o usuario autenticado.

Requisitos:
- Header `Authorization: Bearer <token>`
- Variavel `DATABASE_URL` configurada (veja `.env.example`)

Body (opcional):
```json
{
  "title": "Minha conversa"
}
```

Resposta 201:
```json
{
  "conversation": {
    "id": "ckx123",
    "title": "Minha conversa",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "source": "db"
}
```

Resposta 400 (titulo invalido):
```json
{
  "error": "Invalid title"
}
```

Resposta 401:
```json
{
  "error": "Missing bearer token"
}
```

Resposta 401 (token invalido):
```json
{
  "error": "Invalid token"
}
```

Resposta 401 (token vazio):
```json
{
  "error": "Empty bearer token"
}
```

Resposta 401 (quando o usuario nao foi carregado no request):
```json
{
  "error": "Missing user context"
}
```

Resposta 404 (usuario nao encontrado):
```json
{
  "error": "User not found"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### DELETE /api/conversations

Remove todas as conversas do usuario autenticado e suas mensagens.

Requisitos:
- Header `Authorization: Bearer <token>`
- Variavel `DATABASE_URL` configurada (veja `.env.example`)

Resposta 200:
```json
{
  "deletedConversations": 3,
  "deletedMessages": 42,
  "source": "db"
}
```

Resposta 401:
```json
{
  "error": "Missing bearer token"
}
```

Resposta 401 (token invalido):
```json
{
  "error": "Invalid token"
}
```

Resposta 401 (token vazio):
```json
{
  "error": "Empty bearer token"
}
```

Resposta 401 (quando o usuario nao foi carregado no request):
```json
{
  "error": "Missing user context"
}
```

Resposta 404 (usuario nao encontrado):
```json
{
  "error": "User not found"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### GET /api/conversations/:id

Recupera uma conversa e suas mensagens, incluindo um resumo do contexto do usuario.

Requisitos:
- Header `Authorization: Bearer <token>`
- Variavel `DATABASE_URL` configurada (veja `.env.example`)

Resposta 200:
```json
{
  "conversation": {
    "id": "ckx123",
    "title": "Minha conversa",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "messages": [
    {
      "id": "msg1",
      "role": "user",
      "content": "Ola",
      "createdAt": "2025-01-01T00:00:01.000Z"
    }
  ],
  "contextSummary": "Context integration pending",
  "source": "db"
}
```

Resposta 401:
```json
{
  "error": "Missing bearer token"
}
```

Resposta 401 (token invalido):
```json
{
  "error": "Invalid token"
}
```

Resposta 401 (token vazio):
```json
{
  "error": "Empty bearer token"
}
```

Resposta 401 (quando o usuario nao foi carregado no request):
```json
{
  "error": "Missing user context"
}
```

Resposta 404 (usuario nao encontrado):
```json
{
  "error": "User not found"
}
```

Resposta 404 (conversa nao encontrada):
```json
{
  "error": "Conversation not found"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### POST /api/conversations/:id/messages

Adiciona uma mensagem a uma conversa existente.
Quando `role` e `user`, o backend envia ao agente do Copilot Studio, salva a resposta como `assistant` e atualiza o contexto do usuario.

Requisitos:
- Header `Authorization: Bearer <token>`
- Variavel `DATABASE_URL` configurada (veja `.env.example`)

Body:
```json
{
  "role": "user",
  "content": "Minha nova mensagem"
}
```

Resposta 201:
```json
{
  "message": {
    "id": "msg1",
    "role": "user",
    "content": "Minha nova mensagem",
    "createdAt": "2025-01-01T00:00:01.000Z"
  },
  "assistantMessage": {
    "id": "msg2",
    "role": "assistant",
    "content": "Resposta do agente",
    "createdAt": "2025-01-01T00:00:02.000Z"
  },
  "source": "db"
}
```

Resposta 400 (role invalida):
```json
{
  "error": "Invalid role"
}
```

Resposta 400 (content invalido):
```json
{
  "error": "Invalid content"
}
```

Resposta 401:
```json
{
  "error": "Missing bearer token"
}
```

Resposta 401 (token invalido):
```json
{
  "error": "Invalid token"
}
```

Resposta 401 (token vazio):
```json
{
  "error": "Empty bearer token"
}
```

Resposta 401 (quando o usuario nao foi carregado no request):
```json
{
  "error": "Missing user context"
}
```

Resposta 404 (usuario nao encontrado):
```json
{
  "error": "User not found"
}
```

Resposta 404 (conversa nao encontrada):
```json
{
  "error": "Conversation not found"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 503 (quando `COPILOT_DIRECT_LINE_SECRET` nao esta configurado):
```json
{
  "error": "COPILOT_DIRECT_LINE_SECRET is not set"
}
```

Resposta 429 (quando ha uma requisicao concorrente para a mesma conversa):
```json
{
  "error": "CONVERSATION_BUSY: Aguarde a resposta anterior antes de enviar nova mensagem."
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

### GET /api/context

Retorna um resumo do contexto do usuario autenticado.

Requisitos:
- Header `Authorization: Bearer <token>`
- Variavel `DATABASE_URL` configurada (veja `.env.example`)

Resposta 200:
```json
{
  "userId": "<userId>",
  "summary": "Context integration pending",
  "source": "db"
}
```

Resposta 401:
```json
{
  "error": "Missing bearer token"
}
```

Resposta 401 (token invalido):
```json
{
  "error": "Invalid token"
}
```

Resposta 401 (token vazio):
```json
{
  "error": "Empty bearer token"
}
```

Resposta 401 (quando o usuario nao foi carregado no request):
```json
{
  "error": "Missing user context"
}
```

Resposta 404 (usuario nao encontrado):
```json
{
  "error": "User not found"
}
```

Resposta 503 (quando `DATABASE_URL` nao esta configurada):
```json
{
  "error": "DATABASE_URL is not set"
}
```

Resposta 500:
```json
{
  "error": "Unexpected error"
}
```

## Observacoes

- O backend integra com o Copilot Studio via Direct Line API.
- O frontend pode consumir estes endpoints via HTTP com `Content-Type: application/json`.
