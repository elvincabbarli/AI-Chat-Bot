import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const ai = vi.hoisted(() => ({
  generateContentStream: vi.fn(),
  generateContent: vi.fn(),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = ai;
  },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY' },
}));


function setup() {
  const prisma = {
    conversation: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    message: { findMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  return {
    prisma,
    service: new ChatService(prisma as unknown as PrismaService),
  };
}

beforeEach(() => vi.clearAllMocks());

describe('Conversation ownership', () => {
  it('does not read messages from an inaccessible conversation', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(
      service.getMessages('other-chat', 'alice'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'other-chat', userId: 'alice' },
    });
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('rejects a missing conversation id before a broad database query', async () => {
    const { service, prisma } = setup();
    await expect(
      service.getChatContents(undefined as unknown as string, 'alice', 'Hello'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
  });

  it('does not send another user’s context to AI', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(
      service.getChatContents('other-chat', 'alice', 'Hello'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
    expect(ai.generateContentStream).not.toHaveBeenCalled();
  });

  it('restricts ratings to the owner’s assistant messages', async () => {
    const { service, prisma } = setup();
    prisma.message.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.rateMessage('message', 'alice', 1),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'message',
        role: 'ASSISTANT',
        conversation: { userId: 'alice' },
      },
      data: { rating: 1 },
    });
    await expect(
      service.rateMessage('message', 'alice', 2),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Chat history and validation', () => {
  it('passes the last 20 messages in chronological order with Gemini roles', async () => {
    const { service, prisma } = setup();
    prisma.conversation.findFirst.mockResolvedValue({ id: 'chat' });
    prisma.message.findMany.mockResolvedValue([
      { role: 'ASSISTANT', content: 'Your name is Alice.' },
      { role: 'USER', content: 'My name is Alice.' },
    ]);
    const contents = await service.getChatContents(
      'chat',
      'alice',
      ' What is my name? ',
    );
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'My name is Alice.' }] },
      { role: 'model', parts: [{ text: 'Your name is Alice.' }] },
      { role: 'user', parts: [{ text: 'What is my name?' }] },
    ]);
    ai.generateContentStream.mockResolvedValue(
      (async function* () {
        yield {
          text: 'Alice',
          usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 1 },
        };
      })(),
    );
    const stream = service.streamReply(contents, new AbortController().signal);
    expect(await stream.next()).toEqual({ value: 'Alice', done: false });
    expect(await stream.next()).toEqual({
      value: { promptTokens: 9, completionTokens: 1 },
      done: true,
    });
    expect(ai.generateContentStream).toHaveBeenCalledWith(
      expect.objectContaining({ contents }),
    );
  });

  it('rejects empty input and unknown transform modes', async () => {
    const { service } = setup();
    await expect(
      service.getChatContents('chat', 'alice', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(() =>
      service.buildTransformPrompt('invalid' as 'rewrite', 'text'),
    ).toThrow(BadRequestException);
    await expect(service.generateStructuredNote('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects malformed structured output', async () => {
    const { service } = setup();
    ai.generateContent.mockResolvedValue({ text: '{}' });
    await expect(service.generateStructuredNote('text')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('Rename and delete', () => {
  it('trims and validates titles and only updates the owner’s conversation', async () => {
    const { service, prisma } = setup();
    prisma.conversation.updateMany.mockResolvedValue({ count: 1 });
    await service.renameConversation('chat', 'alice', '  Learning  ');
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'chat', userId: 'alice' },
      data: { title: 'Learning' },
    });
    await expect(
      service.renameConversation('chat', 'alice', ' '),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.renameConversation('chat', 'alice', 'a'.repeat(101)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found when renaming someone else’s chat', async () => {
    const { service, prisma } = setup();
    prisma.conversation.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.renameConversation('other', 'alice', 'Title'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes only the owner’s conversation and rejects inaccessible ids', async () => {
    const { service, prisma } = setup();
    prisma.conversation.deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await service.deleteConversation('chat', 'alice');
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'chat', userId: 'alice' },
    });
    await expect(
      service.deleteConversation('other', 'alice'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Persisting replies', () => {
  it('writes an exchange in one transaction, updates activity and only fills an empty title', async () => {
    const { service, prisma } = setup();
    prisma.conversation.updateMany.mockResolvedValue({ count: 1 });
    prisma.message.create.mockResolvedValue({ createdAt: new Date() });
    await service.saveExchange('chat', 'alice', ' First\nquestion ', 'Answer', {
      promptTokens: 2,
      completionTokens: 3,
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.conversation.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'chat', userId: 'alice' },
      data: { updatedAt: expect.any(Date) },
    });
    expect(prisma.conversation.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'chat', userId: 'alice', title: null },
      data: { title: 'First question' },
    });
    expect(prisma.message.create).toHaveBeenCalledTimes(2);
    expect(prisma.message.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        role: 'ASSISTANT',
        usage: { create: { promptTokens: 2, completionTokens: 3 } },
      }),
    });
  });

  it('does not recreate a chat deleted while the model was answering', async () => {
    const { service, prisma } = setup();
    prisma.conversation.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.saveExchange('deleted', 'alice', 'Question', 'Answer', {
        promptTokens: 0,
        completionTokens: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});


describe('Gemini model configuration', () => {
  it('uses a valid default model for streaming', async () => {
    const previous = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
    try {
      const { service } = setup();
      ai.generateContentStream.mockResolvedValue(
        (async function* () {
          yield { text: 'OK' };
        })(),
      );
      await service.streamReply('Hello', new AbortController().signal).next();
      expect(ai.generateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-flash-latest' }),
      );
    } finally {
      if (previous === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = previous;
    }
  });
  it('uses the configured model for structured output too', async () => {
    const previous = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = 'custom-model';
    try {
      const { service } = setup();
      ai.generateContent.mockResolvedValue({
        text: JSON.stringify({
          title: 'Title',
          summary: 'Summary',
          keyPoints: [],
        }),
      });
      await service.generateStructuredNote('Hello');
      expect(ai.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'custom-model' }),
      );
    } finally {
      if (previous === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = previous;
    }
  });
  it('does not retry a model-not-found error', async () => {
    const { service } = setup();
    const error = Object.assign(new Error('Model not found'), { status: 404 });
    ai.generateContentStream.mockRejectedValue(error);
    await expect(
      service.streamReply('Hello', new AbortController().signal).next(),
    ).rejects.toBe(error);
    expect(ai.generateContentStream).toHaveBeenCalledOnce();
  });
});
