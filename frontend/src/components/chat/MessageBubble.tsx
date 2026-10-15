import { Avatar, Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import type { ChatMessage } from '../../types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  onRate?: (messageId: string, rating: 1 | -1) => void;
}

export function MessageBubble({ message, onRate }: MessageBubbleProps) {
  const isUser = message.role === 'USER';

  return (
    <Stack
      direction={isUser ? 'row-reverse' : 'row'}
      spacing={1.5}
      alignItems="flex-start"
      sx={{ mb: 2.5 }}
    >
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: isUser ? 'secondary.main' : 'primary.main',
        }}
      >
        {isUser ? <PersonIcon fontSize="small" /> : <AutoAwesomeIcon fontSize="small" />}
      </Avatar>

      <Box sx={{ maxWidth: '70%' }}>
        <Paper
          elevation={0}
          sx={{
            p: 1.75,
            bgcolor: isUser ? 'primary.main' : 'grey.100',
            color: isUser ? 'primary.contrastText' : 'text.primary',
            borderRadius: 3,
            borderTopRightRadius: isUser ? 4 : undefined,
            borderTopLeftRadius: isUser ? undefined : 4,
          }}
        >
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Typography>
        </Paper>
        {!isUser && onRate && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            <IconButton
              size="small"
              color={message.rating === 1 ? 'primary' : 'default'}
              onClick={() => onRate(message.id, 1)}
            >
              <ThumbUpIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color={message.rating === -1 ? 'error' : 'default'}
              onClick={() => onRate(message.id, -1)}
            >
              <ThumbDownIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
