import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GoogleGenAI, Type, type Content } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service.js';

interface Usage {
  promptTokens: number;
  completionTokens: number;
}

export interface StructuredNote {
  title: string;
  summary: string;
  keyPoints: string[];
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

@Injectable()
export class ChatService {
  private readonly ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

  private readonly model =
    process.env.GEMINI_MODEL?.trim() || 'gemini-flash-latest';

  constructor(private readonly prisma: PrismaService) {}

  async createConversation(userId: string, email: string): Promise<string> {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email },
    });

    const conversation = await this.prisma.conversation.create({
      data: { userId },
    });

    return conversation.id;
  }

  async listConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async startStream(contents: string | Content[], signal: AbortSignal) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal.aborted) {
        throw new Error('Request was cancelled before it started');
      }
      try {
        return await this.ai.models.generateContentStream({
          model: this.model,
          contents,
          config: { abortSignal: signal },
        });
      } catch (error) {
        lastError = error;

        const status = (error as { status?: number } | null)?.status;
        if (
          signal.aborted ||
          (typeof status === 'number' && status < 500 && status !== 408)
        )
          throw error;
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }
    throw lastError;
  }

  async *streamReply(
    contents: string | Content[],
    signal: AbortSignal,
  ): AsyncGenerator<string, Usage> {
    const usage: Usage = { promptTokens: 0, completionTokens: 0 };

    const stream = await this.startStream(contents, signal);

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }

      if (chunk.usageMetadata) {
        usage.promptTokens = chunk.usageMetadata.promptTokenCount ?? 0;
        usage.completionTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
      }
    }

    return usage;
  }

  async requireConversation(conversationId: string, userId: string) {
    this.validateText(conversationId, 'conversationId', 100);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  validateText(value: unknown, field = 'text', maxLength = 20000): string {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.trim().length > maxLength
    ) {
      throw new BadRequestException(
        field + ' must contain 1–' + maxLength + ' characters',
      );
    }
    return value.trim();
  }

  async getMessages(conversationId: string, userId: string) {
    await this.requireConversation(conversationId, userId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getChatContents(
    conversationId: string,
    userId: string,
    prompt: string,
  ): Promise<Content[]> {
    const text = this.validateText(prompt, 'prompt');
    await this.requireConversation(conversationId, userId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    return [
      ...messages.reverse().map((message) => ({
        role: message.role === 'USER' ? 'user' : 'model',
        parts: [{ text: message.content }],
      })),
      { role: 'user', parts: [{ text }] },
    ];
  }

  async renameConversation(
    conversationId: string,
    userId: string,
    title: string,
  ) {
    const cleanTitle = this.validateText(title, 'title', 100);
    const result = await this.prisma.conversation.updateMany({
      where: { id: conversationId, userId },
      data: { title: cleanTitle },
    });
    if (!result.count) throw new NotFoundException('Conversation not found');
  }

  async deleteConversation(conversationId: string, userId: string) {
    const result = await this.prisma.conversation.deleteMany({
      where: { id: conversationId, userId },
    });
    if (!result.count) throw new NotFoundException('Conversation not found');
  }

  buildTransformPrompt(mode: 'summarize' | 'rewrite', text: string): string {
    text = this.validateText(text);
    if (mode !== 'summarize' && mode !== 'rewrite')
      throw new BadRequestException('Invalid mode');
    if (mode === 'summarize') {
      return `Asagidaki metni qisa ve aydin sekilde, esas fikirleri itirmeden xulasele:\n\n${text}`;
    }
    return `Asagidaki metni daha aydin ve savadli bir dille, mezmununu deyismeden yenidden yaz:\n\n${text}`;
  }

  async generateStructuredNote(text: string): Promise<StructuredNote> {
    text = this.validateText(text);
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: `Asagidaki metni analiz et ve strukturlu nota cevir:\n\n${text}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'summary', 'keyPoints'],
        },
      },
    });

    const note = JSON.parse(response.text ?? '{}') as StructuredNote;
    if (
      typeof note.title !== 'string' ||
      typeof note.summary !== 'string' ||
      !Array.isArray(note.keyPoints) ||
      !note.keyPoints.every((point) => typeof point === 'string')
    ) {
      throw new BadRequestException('Invalid structured response');
    }
    return note;
  }

  async rateMessage(
    messageId: string,
    userId: string,
    rating: number,
  ): Promise<void> {
    if (rating !== 1 && rating !== -1)
      throw new BadRequestException('rating must be 1 or -1');
    const result = await this.prisma.message.updateMany({
      where: { id: messageId, role: 'ASSISTANT', conversation: { userId } },
      data: { rating },
    });
    if (!result.count) throw new NotFoundException('Message not found');
  }

  async saveExchange(
    conversationId: string,
    userId: string,
    userPrompt: string,
    assistantReply: string,
    usage: Usage,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.conversation.updateMany({
        where: { id: conversationId, userId },
        data: { updatedAt: new Date() },
      });
      if (!updated.count) throw new NotFoundException('Conversation not found');

      await tx.conversation.updateMany({
        where: { id: conversationId, userId, title: null },
        data: { title: userPrompt.trim().replace(/\s+/g, ' ').slice(0, 60) },
      });
      const userMessage = await tx.message.create({
        data: { conversationId, role: 'USER', content: userPrompt },
      });
      await tx.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: assistantReply,

          createdAt: new Date(
            Math.max(Date.now(), userMessage.createdAt.getTime() + 1),
          ),
          usage: { create: usage },
        },
      });
    });
  }
}
