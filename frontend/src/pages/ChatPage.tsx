import { useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { useConversations } from '../hooks/useConversations';

export function ChatPage() {
  const {
    conversations,
    loading,
    busy,
    error,
    createNew,
    rename,
    remove,
    refresh,
  } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
    >
      {error && (
        <Alert
          severity="error"
          action={<Button onClick={() => void refresh()}>Refresh</Button>}
        >
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ConversationList
          conversations={conversations}
          loading={loading}
          busy={busy}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={async () => {
            const id = await createNew();
            if (id) setSelectedId(id);
          }}
          onRename={rename}
          onDelete={async (id) => {
            const removed = await remove(id);
            if (removed)
              setSelectedId((current) => (current === id ? null : current));
            return removed;
          }}
        />
        <ChatWindow
          key={selectedId ?? 'empty'}
          conversationId={selectedId}
          onConversationUpdated={refresh}
        />
      </Box>
    </Box>
  );
}
