import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import { generateStructuredNote } from "../../api/chat";
import type { StructuredNote } from "../../types/chat";
import { KeyPointsEditor } from "./KeyPointsEditor";

export function StructuredNoteForm() {
  const [input, setInput] = useState("");
  const [note, setNote] = useState<StructuredNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateStructuredNote(input);
      setNote(result);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 760, mx: "auto", width: "100%" }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <ArticleOutlinedIcon color="primary" />
          <Typography variant="h6">Structured Note</Typography>
        </Stack>

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

        <Button
          sx={{ mt: 2 }}
          variant="contained"
          disabled={loading || !input.trim()}
          onClick={handleGenerate}
        >
          {loading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            "Generate"
          )}
        </Button>

        {note && (
          <Stack spacing={2} sx={{ mt: 3 }}>
            <TextField
              label="Title"
              value={note.title}
              onChange={(event) =>
                setNote({ ...note, title: event.target.value })
              }
              fullWidth
            />
            <TextField
              label="Summary"
              value={note.summary}
              onChange={(event) =>
                setNote({ ...note, summary: event.target.value })
              }
              fullWidth
              multiline
              minRows={3}
            />
            <KeyPointsEditor
              keyPoints={note.keyPoints}
              onChange={(keyPoints) => setNote({ ...note, keyPoints })}
            />
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
