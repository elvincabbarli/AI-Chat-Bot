import { useState } from 'react';
import { Avatar, Box, Button, Paper, Stack, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 45%, #06b6d4 100%)',
        p: 2,
      }}
    >
      <Paper sx={{ p: 5, width: 380, borderRadius: 4 }} elevation={8}>
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            <AutoAwesomeIcon />
          </Avatar>
          <Typography variant="h5" fontWeight={700}>
            AI Writing Assistant
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {mode === 'login'
              ? 'Welcome back - log in to continue'
              : 'Create an account to get started'}
          </Typography>
        </Stack>

        {mode === 'login' ? <LoginForm /> : <SignUpForm />}

        <Button
          fullWidth
          sx={{ mt: 2 }}
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </Button>
      </Paper>
    </Box>
  );
}
