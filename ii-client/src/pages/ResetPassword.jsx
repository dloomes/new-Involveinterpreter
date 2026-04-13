import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import api from "../api";

const inputSx = { "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } };

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = confirm && password !== confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mismatch) return;
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", {
        Email: email,
        Token: token,
        NewPassword: password,
      });
      setDone(true);
    } catch {
      setError("Failed to reset password. The link may have expired — please request a new one.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", fontFamily: "'Open Sans','Roboto',sans-serif" }}>
      {/* Left branding panel */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "45%",
          background: "linear-gradient(145deg,#061926 0%,#0c6ea6 60%,#2ea3f2 100%)",
          color: "#fff",
          p: 6,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box sx={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "rgba(255,255,255,0.04)", top: -100, right: -100 }} />
        <Box sx={{ position: "absolute", width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.04)", bottom: -60, left: -60 }} />
        <Box sx={{ position: "relative", textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: 3, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 3 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>II</Typography>
          </Box>
          <Typography variant="h3" fontWeight={800} sx={{ mb: 1.5, letterSpacing: "-0.5px" }}>Involve Interpreter</Typography>
          <Typography variant="body1" sx={{ opacity: 0.7, maxWidth: 300, lineHeight: 1.7 }}>
            Manage your British Sign Language interpreter bookings in one place.
          </Typography>
        </Box>
      </Box>

      {/* Right form panel */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", bgcolor: "#f8fafc", p: { xs: 3, sm: 6 } }}>
        <Box sx={{ width: "100%", maxWidth: 420 }}>
          {done ? (
            <Box sx={{ textAlign: "center" }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 56, color: "#059669", mb: 2 }} />
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1, color: "#0f172a" }}>Password reset!</Typography>
              <Typography variant="body2" sx={{ mb: 4, color: "#64748b" }}>
                Your password has been updated. You can now sign in.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate("/login")}
                sx={{
                  borderRadius: 2, textTransform: "none", fontWeight: 600,
                  background: "linear-gradient(90deg,#0c6ea6 0%,#2ea3f2 100%)",
                  px: 4, py: 1.5,
                }}
              >
                Back to sign in
              </Button>
            </Box>
          ) : (
            <>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, color: "#0f172a" }}>
                Set new password
              </Typography>
              <Typography variant="body2" sx={{ mb: 4, color: "#64748b" }}>
                Enter a new password for <strong>{email}</strong>
              </Typography>

              {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

              <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                <TextField
                  required fullWidth label="New password"
                  type={showPassword ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  sx={inputSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword((s) => !s)} edge="end" size="small">
                          {showPassword ? <VisibilityOff sx={{ fontSize: 18, color: "#94a3b8" }} /> : <Visibility sx={{ fontSize: 18, color: "#94a3b8" }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  required fullWidth label="Confirm password"
                  type={showConfirm ? "text" : "password"}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  error={mismatch}
                  helperText={mismatch ? "Passwords do not match" : ""}
                  sx={inputSx}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirm((s) => !s)} edge="end" size="small">
                          {showConfirm ? <VisibilityOff sx={{ fontSize: 18, color: "#94a3b8" }} /> : <Visibility sx={{ fontSize: 18, color: "#94a3b8" }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  type="submit" fullWidth variant="contained" size="large"
                  disabled={submitting || mismatch}
                  sx={{
                    mt: 1, py: 1.5, borderRadius: 2, fontWeight: 600, fontSize: "0.95rem",
                    background: "linear-gradient(90deg,#0c6ea6 0%,#2ea3f2 100%)",
                    boxShadow: "0 4px 14px rgba(12,110,166,0.3)", textTransform: "none",
                    "&:hover": { background: "linear-gradient(90deg,#0a5f8f 0%,#1a8fd1 100%)" },
                  }}
                >
                  {submitting ? "Resetting…" : "Reset password"}
                </Button>

                <Button
                  variant="text" size="small" onClick={() => navigate("/login")}
                  sx={{ textTransform: "none", color: "#64748b", alignSelf: "center" }}
                >
                  Back to sign in
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
