import { useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, TextField, InputAdornment, IconButton, CircularProgress,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import api from "../api";

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 2 } };

export default function Activate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("form"); // form | success | error
  const [message, setMessage] = useState("");
  const called = useRef(false);

  if (!token) {
    return (
      <PageShell>
        <ErrorOutlineIcon sx={{ fontSize: 56, color: "#dc2626", mb: 2 }} />
        <Typography variant="h6" fontWeight={700} sx={{ color: "#0f172a", mb: 1 }}>Invalid link</Typography>
        <Typography variant="body2" sx={{ color: "#475569", mb: 4 }}>No activation token was found in this link.</Typography>
        <Button variant="outlined" onClick={() => navigate("/login")} sx={outlinedBtnSx}>Back to login</Button>
      </PageShell>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (called.current) return;

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    called.current = true;
    setMessage("");
    setSubmitting(true);

    try {
      const res = await api.post("/auth/activate", { token, password });
      setStatus("success");
      setMessage(res.data.message);
    } catch (err) {
      called.current = false; // allow retry on error
      setStatus("error");
      setMessage(err?.response?.data?.message || "Activation failed. The link may be invalid or expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      {status === "form" && (
        <>
          <Typography variant="h6" fontWeight={700} sx={{ color: "#0f172a", mb: 0.5 }}>
            Set your password
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mb: 3 }}>
            Choose a password to activate your account.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
            <TextField
              label="New password"
              fullWidth
              size="small"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setMessage(""); }}
              sx={fieldSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw((s) => !s)}>
                      {showPw ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm password"
              fullWidth
              size="small"
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setMessage(""); }}
              sx={fieldSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowConfirm((s) => !s)}>
                      {showConfirm ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {message && (
              <Typography variant="body2" sx={{ color: "#dc2626", fontSize: "0.82rem" }}>
                {message}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting || !password || !confirm}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 600, mt: 1,
                background: "linear-gradient(90deg,#0c6ea6 0%,#2ea3f2 100%)",
                "&:hover": { background: "linear-gradient(90deg,#0a5f8f 0%,#1a8fd1 100%)" },
              }}
            >
              {submitting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Activate account"}
            </Button>
          </Box>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircleOutlineIcon sx={{ fontSize: 56, color: "#16a34a", mb: 2 }} />
          <Typography variant="h6" fontWeight={700} sx={{ color: "#0f172a", mb: 1 }}>Account activated!</Typography>
          <Typography variant="body2" sx={{ color: "#475569", mb: 4 }}>{message}</Typography>
          <Button variant="contained" onClick={() => navigate("/login")}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, px: 4, background: "linear-gradient(90deg,#0c6ea6 0%,#2ea3f2 100%)", "&:hover": { background: "linear-gradient(90deg,#0a5f8f 0%,#1a8fd1 100%)" } }}>
            Go to login
          </Button>
        </>
      )}

      {status === "error" && (
        <>
          <ErrorOutlineIcon sx={{ fontSize: 56, color: "#dc2626", mb: 2 }} />
          <Typography variant="h6" fontWeight={700} sx={{ color: "#0f172a", mb: 1 }}>Activation failed</Typography>
          <Typography variant="body2" sx={{ color: "#475569", mb: 4 }}>{message}</Typography>
          <Button variant="outlined" onClick={() => navigate("/login")} sx={outlinedBtnSx}>Back to login</Button>
        </>
      )}
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f8fafc" }}>
      <Box sx={{ bgcolor: "#fff", border: "1px solid #e2e8f0", borderRadius: 3, p: 5, maxWidth: 440, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <Typography variant="h6" fontWeight={700} sx={{ color: "#003366", mb: 4, letterSpacing: "-0.3px" }}>
          Involve Interpreter
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

const outlinedBtnSx = {
  borderRadius: 2, textTransform: "none",
  borderColor: "#e2e8f0", color: "#475569",
  "&:hover": { borderColor: "#94a3b8" },
};
