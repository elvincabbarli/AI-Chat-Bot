import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Content } from '@google/genai';
import { Observable } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { ChatService } from './chat.service.js';
import { streamErrorMessage } from './stream-error.js';

@UseGuards(AuthGuard)
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  async createConversation(@Req() req: AuthenticatedRequest) {
    const conversationId = await this.chatService.createConversation(
      req.user.id,
      req.user.email ?? '',
    );
    return { conversationId };
  }

  @Get('conversations')
  listConversations(@Req() req: AuthenticatedRequest) {
    return this.chatService.listConversations(req.user.id);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.chatService.getMessages(id, req.user.id);
  }

  @Patch('conversations/:id')
  async renameConversation(
    @Param('id') id: string,
    @Body('title') title: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.chatService.renameConversation(id, req.user.id, title);
    return { ok: true };
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.chatService.deleteConversation(id, req.user.id);
    return { ok: true };
  }

  @Post('messages/:id/rating')
  async rateMessage(
    @Param('id') id: string,
    @Body('rating') rating: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.chatService.rateMessage(id, req.user.id, rating);
    return { ok: true };
  }

  @Post('structured')
  generateStructured(@Body('text') text: string) {
    return this.chatService.generateStructuredNote(text);
  }

  @Sse('transform')
  transform(
    @Query('mode') mode: 'summarize' | 'rewrite',
    @Query('text') text: string,
  ) {
    return this.createStream(this.chatService.buildTransformPrompt(mode, text));
  }

  @Sse('stream')
  async stream(
    @Query('conversationId') id: string,
    @Query('prompt') prompt: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const contents = await this.chatService.getChatContents(
      id,
      req.user.id,
      prompt,
    );
    return this.createStream(contents, {
      id,
      userId: req.user.id,
      prompt: prompt.trim(),
    });
  }

  private createStream(
    contents: string | Content[],
    conversation?: { id: string; userId: string; prompt: string },
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const abort = new AbortController();
      let reply = '';
      let savingStarted = false;
      const run = async () => {
        try {
          const generator = this.chatService.streamReply(
            contents,
            abort.signal,
          );
          while (true) {
            const { value, done } = await generator.next();
            if (done) {
              if (conversation) {
                savingStarted = true;
                await this.chatService.saveExchange(
                  conversation.id,
                  conversation.userId,
                  conversation.prompt,
                  reply,
                  value,
                );
              }
              break;
            }
            reply += value;
            subscriber.next({ data: value });
          }
          subscriber.next({ type: 'done', data: '' });
          subscriber.complete();
        } catch (error) {
          if (abort.signal.aborted && conversation && reply && !savingStarted) {
            try {
              await this.chatService.saveExchange(
                conversation.id,
                conversation.userId,
                conversation.prompt,
                reply,
                { promptTokens: 0, completionTokens: 0 },
              );
            } catch {
              this.logger.warn(
                'Cancelled reply could not be saved (conversation may have been deleted).',
              );
            }
          }
          if (!abort.signal.aborted) {
            const status = (error as { status?: number } | null)?.status;
            this.logger.error(
              'Chat ' +
                (savingStarted ? 'persistence' : 'generation') +
                ' failed; HTTP status: ' +
                (typeof status === 'number' ? status : 'unknown'),
            );
            subscriber.next({
              type: 'failure',
              data: streamErrorMessage(error, savingStarted),
            });
          }
          subscriber.complete();
        }
      };
      void run();
      return () => abort.abort();
    });
  }
}
