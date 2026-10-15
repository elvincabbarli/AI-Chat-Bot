import { useState } from "react";
import { Box, IconButton, Paper, TextField } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import StopCircleIcon from "@mui/icons-material/StopCircle";

interface MessageInputProps {
  disabled: boolean;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export function MessageInput({
  disabled,
  isStreaming,
  onSend,
  onCancel,
}: MessageInputProps) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <Box
      sx={{
        p: 2,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 0.5,
          pl: 2,
          borderRadius: 4,
        }}
      >
        <TextField
          fullWidth
          variant="standard"
          placeholder="Type a message..."
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          slotProps={{ input: { disableUnderline: true } }}
        />
        {isStreaming ? (
          <IconButton color="error" onClick={onCancel}>
            <StopCircleIcon />
          </IconButton>
        ) : (
          <IconButton color="primary" onClick={handleSend} disabled={disabled}>
            <SendIcon />
          </IconButton>
        )}
      </Paper>
    </Box>
  );
}
