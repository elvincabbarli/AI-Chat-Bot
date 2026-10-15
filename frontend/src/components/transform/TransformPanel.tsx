import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useTransformStream } from '../../hooks/useTransformStream';
import type { TransformMode } from '../../types/chat';

export function TransformPanel() {
  const [mode, setMode] = useState<TransformMode>('summarize');
  const [input, setInput] = useState('');
  const { resultText, isStreaming, error, run, cancel } = useTransformStream();

  return (
    <Box sx={{ p: 4, maxWidth: 760, mx: 'auto', width: '100%' }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <AutoFixHighIcon color="primary" />
          <Typography variant="h6">Summarize / Rewrite</Typography>
        </Stack>

        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_event, value: TransformMode | null) =>
            value && setMode(value)
          }
          sx={{ mb: 2 }}
        >
          <ToggleButton value="summarize">Summarize</ToggleButton>
          <ToggleButton value="rewrite">Rewrite</ToggleButton>
        </ToggleButtonGroup>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          multiline
          minRows={6}
          placeholder="Paste your text here..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            disabled={isStreaming || !input.trim()}
            onClick={() => run(mode, input)}
          >
            Run
          </Button>
          {isStreaming && (
            <Button color="error" variant="outlined" onClick={cancel}>
              Cancel
            </Button>
          )}
        </Stack>

        {(resultText || isStreaming) && (
          <Paper
            variant="outlined"
            sx={{
              mt: 3,
              p: 2,
              whiteSpace: 'pre-wrap',
              bgcolor: 'background.default',
            }}
          >
            <Typography variant="body1">{resultText}</Typography>
          </Paper>
        )}
      </Paper>
    </Box>
  );
}
