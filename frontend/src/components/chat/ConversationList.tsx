import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { Conversation } from '../../types/chat';

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  busy: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => Promise<void>;
  onRename: (id: string, title: string) => Promise<boolean | null>;
  onDelete: (id: string) => Promise<boolean | null>;
}

export function ConversationList({
  conversations,
  loading,
  busy,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ConversationListProps) {
  const [dialog, setDialog] = useState<{
    kind: 'rename' | 'delete';
    conversation: Conversation;
  } | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!dialog || busy) return;
    setError(null);
    try {
      const ok =
        dialog.kind === 'rename'
          ? await onRename(dialog.conversation.id, title.trim())
          : await onDelete(dialog.conversation.id);
      if (ok) setDialog(null);
      else setError('The operation failed. Please try again.');
    } catch {
      setError('The operation failed. Please try again.');
    }
  };
  return (
    <Box
      sx={{
        width: { xs: 190, sm: 280 },
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          disabled={busy}
          onClick={() => void onCreate()}
        >
          New chat
        </Button>
      </Box>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {!loading && conversations.length === 0 && (
        <Typography variant="body2" sx={{ px: 2 }}>
          No conversations yet
        </Typography>
      )}
      <List sx={{ overflowY: 'auto', px: 1 }}>
        {conversations.map((conversation) => (
          <ListItem
            key={conversation.id}
            disablePadding
            secondaryAction={
              <Box>
                <Tooltip title="Rename">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Rename conversation"
                      disabled={busy}
                      onClick={() => {
                        setTitle(conversation.title ?? '');
                        setError(null);
                        setDialog({ kind: 'rename', conversation });
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Delete">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Delete conversation"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        setDialog({ kind: 'delete', conversation });
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            }
          >
            <ListItemButton
              selected={conversation.id === selectedId}
              onClick={() => onSelect(conversation.id)}
              sx={{ borderRadius: 2, pr: 9 }}
            >
              <ListItemText
                primary={conversation.title ?? 'Untitled chat'}
                secondary={new Date(
                  conversation.updatedAt,
                ).toLocaleDateString()}
                slotProps={{ primary: { noWrap: true } }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Dialog
        open={dialog !== null}
        onClose={() => {
          if (!busy) setDialog(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {dialog?.kind === 'rename' ? 'Rename conversation' : 'Delete conversation'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {dialog?.kind === 'rename' ? (
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label="Conversation title"
              value={title}
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 100 } }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && title.trim() && !busy) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
          ) : (
            <DialogContentText>
              “{dialog?.conversation.title ?? 'Untitled chat'}” and all
              messages will be deleted. This action cannot be undone.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={dialog?.kind === 'delete' ? 'error' : 'primary'}
            disabled={busy || (dialog?.kind === 'rename' && !title.trim())}
            onClick={() => void submit()}
          >
            {dialog?.kind === 'rename' ? 'Save' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
