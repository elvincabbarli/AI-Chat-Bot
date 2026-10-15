import { useState } from 'react';
import { Box, CircularProgress, Tab, Tabs } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import { useAuth } from './auth/useAuth';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { AppLayout } from './components/layout/AppLayout';
import { TransformPanel } from './components/transform/TransformPanel';
import { StructuredNoteForm } from './components/structured/StructuredNoteForm';

type Section = 'chat' | 'transform' | 'structured';

function App() {
  const { session, loading } = useAuth();
  const [section, setSection] = useState<Section>('chat');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={section}
          onChange={(_event, value: Section) => setSection(value)}
          sx={{ px: 2 }}
        >
          <Tab icon={<ChatBubbleOutlineIcon fontSize="small" />} iconPosition="start" label="Chat" value="chat" />
          <Tab
            icon={<AutoFixHighIcon fontSize="small" />}
            iconPosition="start"
            label="Summarize / Rewrite"
            value="transform"
          />
          <Tab
            icon={<ArticleOutlinedIcon fontSize="small" />}
            iconPosition="start"
            label="Structured Note"
            value="structured"
          />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'auto' }}>
        {section === 'chat' && <ChatPage />}
        {section === 'transform' && <TransformPanel />}
        {section === 'structured' && <StructuredNoteForm />}
      </Box>
    </AppLayout>
  );
}

export default App;
