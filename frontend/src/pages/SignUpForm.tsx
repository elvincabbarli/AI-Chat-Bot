import { useState } from "react";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { supabase } from "../auth/supabaseClient";

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else
        setInfo("Account created - check your email to confirm, then log in.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {info && <Alert severity="success">{info}</Alert>}
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        fullWidth
      />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        fullWidth
        helperText="Minimum 6 characters"
      />
      <Button
        variant="contained"
        size="large"
        onClick={handleSubmit}
        disabled={loading}
      >
        Sign up
      </Button>
    </Stack>
  );
}
