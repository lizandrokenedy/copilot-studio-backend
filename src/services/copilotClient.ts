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

async function directLineStartConversation(): Promise<string> {
  const res = await fetch(`${directLineBaseUrl()}/conversations`, {
    method: "POST",
    headers: {
      ...directLineAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Direct Line startConversation failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { conversationId: string };
  if (!data.conversationId) throw new Error("Direct Line did not return conversationId");
  return data.conversationId;
}

async function directLineSendMessage(conversationId: string, text: string): Promise<string> {
  const activity = {
    type: "message",
    from: { id: "local-user" },
    text,
  };

  const res = await fetch(`${directLineBaseUrl()}/conversations/${conversationId}/activities`, {
    method: "POST",
    headers: {
      ...directLineAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(activity),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Direct Line sendActivity failed: ${res.status} ${body}`);
  }

  return await directLineWaitBotReply(conversationId);
}

async function directLineWaitBotReply(conversationId: string): Promise<string> {
  const startedAt = Date.now();
  let watermark: string | undefined;

  while (Date.now() - startedAt < 20_000) {
    const url = new URL(`${directLineBaseUrl()}/conversations/${conversationId}/activities`);
    if (watermark) url.searchParams.set("watermark", watermark);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...directLineAuthHeader(),
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Direct Line getActivities failed: ${res.status} ${body}`);
    }

    const data = (await res.json()) as {
      watermark?: string;
      activities?: Array<{ type: string; from?: { id?: string }; text?: string }>;
    };

    watermark = data.watermark;

    const botMessages =
      (data.activities || [])
        .filter((a) => a.type === "message")
        .filter((a) => (a.from?.id || "") !== "local-user")
        .map((a) => a.text)
        .filter(Boolean) as string[];

    if (botMessages.length > 0) {
      return botMessages.join("\n").trim();
    }

    await new Promise((r) => setTimeout(r, 700));
  }

  return "";
}

async function ensureCopilotConversationId(conversationId: string): Promise<string> {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new Error("Conversation not found");

  if (conversation.copilotConversationId) return conversation.copilotConversationId;

  const directLineConversationId = await directLineStartConversation();

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

  const title = input.title?.trim() || "New conversation";
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

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: user.id },
  });
  if (!conversation) throw new Error("Conversation not found");

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
    const replyText = await directLineSendMessage(directLineConversationId, input.content);

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

  await updateUserContextSummary(user.id, conversation.id);

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
}
