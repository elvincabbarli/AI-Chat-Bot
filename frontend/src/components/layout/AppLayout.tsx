import { AppBar, Avatar, Box, Button, Stack, Toolbar, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LogoutIcon from '@mui/icons-material/Logout';
import type { ReactNode } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useAuth } from '../../auth/useAuth';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { session } = useAuth();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34 }}>
              <AutoAwesomeIcon fontSize="small" />
            </Avatar>
            <Typography variant="h6">AI Writing Assistant</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {session?.user.email}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={() => supabase.auth.signOut()}
            >
              Log out
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>
    </Box>
  );
}
