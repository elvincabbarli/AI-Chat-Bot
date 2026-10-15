import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useMessages } from '../../hooks/useMessages';
import { useChatStream } from '../../hooks/useChatStream';
import { rateMessage } from '../../api/chat';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

interface ChatWindowProps {
  conversationId: string | null;
  onConversationUpdated: () => Promise<void>;
}

export function ChatWindow({
  conversationId,
  onConversationUpdated,
}: ChatWindowProps) {
  const {
    messages,
    loading,
    error: loadError,
    refresh,
  } = useMessages(conversationId);
  const {
    streamingText,
    pendingPrompt,
    isStreaming,
    error,
    notice,
    sendPrompt,
    cancel,
    clearPreview,
  } = useChatStream(conversationId);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, pendingPrompt]);

  const reload = async () => {
    const success = await refresh();
    if (success) clearPreview();
    await onConversationUpdated();
  };
  const complete = async () => {
    const success = await refresh();
    if (success) clearPreview();
    await onConversationUpdated();
    return success;
  };
  const handleRate = async (id: string, rating: 1 | -1) => {
    setRatingError(null);
    try {
      await rateMessage(id, rating);
      await refresh();
    } catch {
      setRatingError('The rating could not be submitted. Please try again.');
    }
  };

  if (!conversationId)
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack alignItems="center" spacing={1}>
          <ChatBubbleOutlineIcon
            sx={{ fontSize: 40, color: 'text.disabled' }}
          />
          <Typography color="text.secondary">
            Select a chat or start a new one
          </Typography>
        </Stack>
      </Box>
    );

  const preview = {
    createdAt: new Date().toISOString(),
    conversationId,
    rating: null,
  };
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {(loadError || error || ratingError) && (
        <Alert severity="error">{loadError || error || ratingError}</Alert>
      )}
      {notice && <Alert severity="info">{notice}</Alert>}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2 }}>
        <Button disabled={isStreaming || loading} onClick={() => void reload()}>
          Refresh history
        </Button>
      </Box>
      <Box
        sx={{ flex: 1, overflowY: 'auto', p: 3, bgcolor: 'background.default' }}
      >
        {loading && <CircularProgress size={20} />}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onRate={isStreaming || pendingPrompt ? undefined : handleRate}
          />
        ))}
        {pendingPrompt && (
          <MessageBubble
            message={{
              ...preview,
              id: 'pending-user',
              role: 'USER',
              content: pendingPrompt,
            }}
          />
        )}
        {(isStreaming || streamingText) && (
          <MessageBubble
            message={{
              ...preview,
              id: 'streaming-preview',
              role: 'ASSISTANT',
              content: streamingText,
            }}
          />
        )}
        <div ref={bottomRef} />
      </Box>
      <MessageInput
        disabled={isStreaming || loading || !!loadError || !!notice}
        isStreaming={isStreaming}
        onSend={(text) => sendPrompt(text, complete)}
        onCancel={cancel}
      />
    </Box>
  );
}
