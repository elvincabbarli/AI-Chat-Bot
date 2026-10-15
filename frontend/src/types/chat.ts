export type MessageRole = "USER" | "ASSISTANT";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  conversationId: string;
  rating: number | null;
}

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface StructuredNote {
  title: string;
  summary: string;
  keyPoints: string[];
}

export type TransformMode = "summarize" | "rewrite";
