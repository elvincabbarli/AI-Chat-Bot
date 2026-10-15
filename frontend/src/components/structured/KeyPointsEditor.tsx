import { Box, IconButton, TextField, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

interface KeyPointsEditorProps {
  keyPoints: string[];
  onChange: (keyPoints: string[]) => void;
}

export function KeyPointsEditor({ keyPoints, onChange }: KeyPointsEditorProps) {
  const updateAt = (index: number, value: string) => {
    const next = [...keyPoints];
    next[index] = value;
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(keyPoints.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Key points
      </Typography>
      {keyPoints.map((point, index) => (
        <Box key={index} sx={{ display: "flex", gap: 1, mb: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={point}
            onChange={(e) => updateAt(index, e.target.value)}
          />
          <IconButton size="small" onClick={() => removeAt(index)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}
