import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#6366f1", light: "#818cf8", dark: "#4338ca" },
    secondary: { main: "#06b6d4" },
    background: { default: "#f4f5fb", paper: "#ffffff" },
    text: { primary: "#1e1b2e", secondary: "#6b7280" },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10 },
        contained: { boxShadow: "none" },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#1e1b2e",
          borderBottom: "1px solid #e5e7eb",
        },
      },
    },
  },
});
