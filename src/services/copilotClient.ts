import type { AuthenticatedUser } from "../types";
import { env } from "../config/env";
import { prisma } from "../config/prisma";

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type ConversationDetail = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type ConversationListResponse = {
  conversations: ConversationSummary[];
  source: "db" | "stub" | "copilot";
};

export type ConversationDetailResponse = {
  conversation: ConversationDetail;
  messages: ConversationMessage[];
  contextSummary: string;
  source: "db" | "stub" | "copilot";
};

export type UserContextResponse = {
  userId: string;
  summary: string;
  source: "db" | "stub" | "copilot";
};

export type CreateConversationInput = {
  title?: string;
};

export type CreateConversationResponse = {
  conversation: ConversationDetail;
  source: "db" | "stub" | "copilot";
};

export type AddMessageInput = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AddMessageResponse = {
  message: ConversationMessage;
  assistantMessage?: ConversationMessage;
  source: "db" | "stub" | "copilot";
};

export type DeleteConversationsResponse = {
  deletedConversations: number;
  deletedMessages: number;
  source: "db" | "stub" | "copilot";
};

// In-memory guards and watermark tracking per conversation.
const conversationWatermarks = new Map<string, string>();
const conversationLocks = new Map<string, boolean>();
const DIRECT_LINE_TIMEOUT_MS = 10_000;
const DIRECT_LINE_POLL_BASE_MS = 1500;
const DIRECT_LINE_POLL_MAX_MS = 5000;
const DIRECT_LINE_RETRY_DELAY_MS = 30_000;

function assertDatabaseConfigured() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is not set");
}

function assertDirectLineConfigured() {
  if (!env.copilotDirectLineSecret) {
    throw new Error("COPILOT_DIRECT_LINE_SECRET is not set");
  }
}

async function requireUser(user: AuthenticatedUser) {
  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  if (!existing) throw new Error("User not found");
  return existing;
}

function directLineBaseUrl() {
  return env.directLineBaseUrl || "https://directline.botframework.com/v3/directline";
}

function directLineAuthHeader() {
  assertDirectLineConfigured();
  return { Authorization: `Bearer ${env.copilotDirectLineSecret}` };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConversationNotFoundMessage(message: string) {
  const lowered = message.toLowerCase();
  return lowered.includes("resource not found") || lowered.includes("conversation not found");
}

function isUsageLimitMessage(message: string) {
  return message.toLowerCase().includes("usage limit");
}

function nextPollDelayMs(attempt: number) {
  const next = DIRECT_LINE_POLL_BASE_MS + attempt * 500;
  return Math.min(next, DIRECT_LINE_POLL_MAX_MS);
}

async function directLineFetch(
  url: string | URL,
  options: RequestInit,
  label: string
): Promise<Response> {
  const startedAt = Date.now();
  const res = await fetch(url, options);
  const elapsed = Date.now() - startedAt;
  console.log(`[directline] ${label} ${res.status} ${elapsed}ms`);
  return res;
}

async function directLineStartConversation(): Promise<string> {
  const res = await directLineFetch(`${directLineBaseUrl()}/conversations`, {
    method: "POST",
    headers: {
      ...directLineAuthHeader(),
      "Content-Type": "application/json",
    },
  }, "POST /conversations");

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Direct Line startConversation failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { conversationId: string };
  if (!data.conversationId) throw new Error("Direct Line did not return conversationId");
  return data.conversationId;
}

async function directLineSendMessage(
  localConversationId: string,
  directLineConversationId: string,
  text: string
): Promise<string> {
  const activity = {
    type: "message",
    from: { id: "local-user" },
    text,
  };

  const res = await directLineFetch(
    `${directLineBaseUrl()}/conversations/${directLineConversationId}/activities`,
    {
      method: "POST",
      headers: {
        ...directLineAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(activity),
    },
    "POST /activities"
  );

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429 || res.status === 503) {
      console.warn(`[directline] throttling on sendActivity status=${res.status}`);
      await delay(DIRECT_LINE_RETRY_DELAY_MS);
      const retryRes = await directLineFetch(
        `${directLineBaseUrl()}/conversations/${directLineConversationId}/activities`,
        {
          method: "POST",
          headers: {
            ...directLineAuthHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(activity),
        },
        "POST /activities retry"
      );
      if (!retryRes.ok) {
        const retryBody = await retryRes.text();
        throw new Error(`Direct Line sendActivity failed: ${retryRes.status} ${retryBody}`);
      }
      return await directLineWaitBotReply(localConversationId, directLineConversationId);
    }
    throw new Error(`Direct Line sendActivity failed: ${res.status} ${body}`);
  }

  return await directLineWaitBotReply(localConversationId, directLineConversationId);
}

async function directLineWaitBotReply(
  localConversationId: string,
  directLineConversationId: string
): Promise<string> {
  const startedAt = Date.now();
  let watermark = conversationWatermarks.get(localConversationId);
  let polls = 0;
  let attempt = 0;

  while (Date.now() - startedAt < DIRECT_LINE_TIMEOUT_MS) {
    const url = new URL(
      `${directLineBaseUrl()}/conversations/${directLineConversationId}/activities`
    );
    if (watermark) url.searchParams.set("watermark", watermark);

    const res = await directLineFetch(
      url,
      {
        method: "GET",
        headers: {
          ...directLineAuthHeader(),
          "Content-Type": "application/json",
        },
      },
      "GET /activities"
    );

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429 || res.status === 503) {
        console.warn(`[directline] throttling on getActivities status=${res.status}`);
        await delay(nextPollDelayMs(attempt));
        attempt += 1;
        continue;
      }
      throw new Error(`Direct Line getActivities failed: ${res.status} ${body}`);
    }

    const data = (await res.json()) as {
      watermark?: string;
      activities?: Array<{ type: string; from?: { id?: string }; text?: string }>;
    };

    watermark = data.watermark;
    if (watermark) conversationWatermarks.set(localConversationId, watermark);
    polls += 1;

    const botMessages =
      (data.activities || [])
        .filter((a) => a.type === "message")
        .filter((a) => (a.from?.id || "") !== "local-user")
        .map((a) => a.text)
        .filter(Boolean) as string[];

    if (botMessages.length > 0) {
      if (botMessages.some((message) => isUsageLimitMessage(message))) {
        console.warn("[directline] usage limit message received");
        throw new Error("COPILOT_USAGE_LIMIT");
      }
      console.log(`[directline] reply received polls=${polls}`);
      return botMessages.join("\n").trim();
    }

    await delay(nextPollDelayMs(attempt));
    attempt += 1;
  }

  console.log(`[directline] no reply before timeout polls=${polls}`);
  return "";
}

async function ensureCopilotConversationId(conversationId: string): Promise<string> {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new Error("Conversation not found");

  if (conversation.copilotConversationId) return conversation.copilotConversationId;

  const directLineConversationId = await directLineStartConversation();
  conversationWatermarks.delete(conversationId);

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { copilotConversationId: directLineConversationId },
  });

  return directLineConversationId;
}

async function updateUserContextSummary(userId: string, conversationId: string): Promise<string> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const summaryLines = messages
    .slice()
    .reverse()
    .map((m) => `${m.role}: ${m.content}`);

  let summary = summaryLines.join("\n");
  if (summary.length > 2000) summary = `${summary.slice(0, 2000)}...`;

  await prisma.userContext.upsert({
    where: { userId },
    update: { summary },
    create: { userId, summary },
  });

  return summary;
}

export async function listUserConversations(user: AuthenticatedUser): Promise<ConversationListResponse> {
  assertDatabaseConfigured();
  await requireUser(user);

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return {
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt.toISOString(),
    })),
    source: "db",
  };
}

export async function getUserContext(user: AuthenticatedUser): Promise<UserContextResponse> {
  assertDatabaseConfigured();
  await requireUser(user);

  const context = await prisma.userContext.findUnique({ where: { userId: user.id } });

  return {
    userId: user.id,
    summary: context?.summary ?? "Context integration pending",
    source: "db",
  };
}

export async function createConversation(
  user: AuthenticatedUser,
  input: CreateConversationInput
): Promise<CreateConversationResponse> {
  assertDatabaseConfigured();
  await requireUser(user);

  const trimmedTitle = input.title?.trim();
  const normalizedTitle = trimmedTitle?.toLowerCase();
  let title = trimmedTitle;
  if (!title || normalizedTitle === "nova conversa" || normalizedTitle === "new conversation") {
    const total = await prisma.conversation.count({ where: { userId: user.id } });
    title = `Conversa ${total + 1}`;
  }
  const conversation = await prisma.conversation.create({
    data: { userId: user.id, title },
  });

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    source: "db",
  };
}

export async function deleteUserConversations(
  user: AuthenticatedUser
): Promise<DeleteConversationsResponse> {
  assertDatabaseConfigured();
  await requireUser(user);

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const conversationIds = conversations.map((c) => c.id);

  if (conversationIds.length === 0) {
    return { deletedConversations: 0, deletedMessages: 0, source: "db" };
  }

  const [deletedMessages, deletedConversations] = await prisma.$transaction([
    prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } }),
    prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } }),
  ]);

  return {
    deletedConversations: deletedConversations.count,
    deletedMessages: deletedMessages.count,
    source: "db",
  };
}

export async function getConversationDetail(
  user: AuthenticatedUser,
  conversationId: string
): Promise<ConversationDetailResponse> {
  assertDatabaseConfigured();
  await requireUser(user);

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: user.id },
  });
  if (!conversation) throw new Error("Conversation not found");

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  const context = await prisma.userContext.findUnique({ where: { userId: user.id } });

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role as any,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    contextSummary: context?.summary ?? "Context integration pending",
    source: "db",
  };
}

export async function addConversationMessage(
  user: AuthenticatedUser,
  conversationId: string,
  input: AddMessageInput
): Promise<AddMessageResponse> {
  assertDatabaseConfigured();
  await requireUser(user);

  if (conversationLocks.get(conversationId)) {
    throw new Error("CONVERSATION_BUSY: Aguarde a resposta anterior antes de enviar nova mensagem.");
  }

  conversationLocks.set(conversationId, true);

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: user.id },
  });
  if (!conversation) {
    conversationLocks.delete(conversationId);
    throw new Error("Conversation not found");
  }

  try {
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: input.role,
        content: input.content,
      },
    });

    let assistantMessage: ConversationMessage | undefined;

    if (input.role === "user") {
      const directLineConversationId = await ensureCopilotConversationId(conversation.id);
      let replyText = "";
      try {
        replyText = await directLineSendMessage(
          conversation.id,
          directLineConversationId,
          input.content
        );
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "";
        if (messageText.includes("COPILOT_USAGE_LIMIT")) {
          console.warn("[directline] usage limit reached for conversation");
          const assistant = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: "assistant",
              content:
                "O agente atingiu o limite de uso no momento. Tente novamente em alguns instantes.",
            },
          });

          assistantMessage = {
            id: assistant.id,
            role: "assistant",
            content: assistant.content,
            createdAt: assistant.createdAt.toISOString(),
          };
          replyText = "";
        } else if (isConversationNotFoundMessage(messageText)) {
          const newConversationId = await directLineStartConversation();
          conversationWatermarks.delete(conversation.id);
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { copilotConversationId: newConversationId },
          });
          replyText = await directLineSendMessage(conversation.id, newConversationId, input.content);
        } else {
          throw error;
        }
      }

      if (replyText) {
        const assistant = await prisma.message.create({
          data: { conversationId: conversation.id, role: "assistant", content: replyText },
        });

        assistantMessage = {
          id: assistant.id,
          role: "assistant",
          content: assistant.content,
          createdAt: assistant.createdAt.toISOString(),
        };
      }
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // await updateUserContextSummary(user.id, conversation.id);

    return {
      message: {
        id: message.id,
        role: message.role as any,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
      assistantMessage,
      source: "db",
    };
  } finally {
    conversationLocks.delete(conversationId);
  }
}
