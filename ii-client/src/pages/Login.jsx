import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
} from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useAuth } from "../AuthContext.jsx";
import api from "../api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch {
      setError("Invalid email or password.");
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { Email: forgotEmail });
      setForgotDone(true);
    } catch (err) {
      const msg = err?.response?.data?.error;
      setForgotError(msg || "Something went wrong. Please try again.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        fontFamily: "'Open Sans', 'Roboto', sans-serif",
      }}
    >
      {/* Left panel — branding */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "45%",
          background: "linear-gradient(145deg, #061926 0%, #0c6ea6 60%, #2ea3f2 100%)",
          color: "#fff",
          p: 6,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <Box
          sx={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            top: -100,
            right: -100,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            width: 280,
            borderRadius: "50%",
            height: 280,
            background: "rgba(255,255,255,0.04)",
            bottom: -60,
            left: -60,
          }}
        />

        <Box sx={{ position: "relative", textAlign: "center" }}>
          <Box sx={{ mb: 4 }}>
            <img
              src="/logo.png"
              alt="Involve Interpreter"
              style={{ height: 52, objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
          </Box>

          <Typography variant="h3" fontWeight={800} sx={{ mb: 1.5, letterSpacing: "-0.5px" }}>
            Involve Interpreter
          </Typography>
          <Typography
            variant="body1"
            sx={{ opacity: 0.7, maxWidth: 300, lineHeight: 1.7 }}
          >
            Manage your British Sign Language interpreter bookings in one place.
          </Typography>

          <Box
            sx={{
              mt: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {["Secure booking management", "Role-based access control"].map(
              (feature) => (
                <Box
                  key={feature}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#5db8ff",
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {feature}
                  </Typography>
                </Box>
              )
            )}
          </Box>
        </Box>
      </Box>

      {/* Right panel — form */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#f8fafc",
          p: { xs: 3, sm: 6 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 420 }}>

          {/* ── Forgot password view ── */}
          {forgotMode ? (
            forgotDone ? (
              <Box sx={{ textAlign: "center" }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 52, color: "#059669", mb: 2 }} />
                <Typography variant="h5" fontWeight={700} sx={{ mb: 1, color: "#0f172a" }}>Check your email</Typography>
                <Typography variant="body2" sx={{ mb: 4, color: "#64748b" }}>
                  If an account exists for <strong>{forgotEmail}</strong>, a reset link has been sent. Check your inbox.
                </Typography>
                <Button
                  variant="text" size="small"
                  onClick={() => { setForgotMode(false); setForgotDone(false); setForgotEmail(""); }}
                  sx={{ textTransform: "none", color: "#0c6ea6", fontWeight: 600 }}
                >
                  Back to sign in
                </Button>
              </Box>
            ) : (
              <>
                <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, color: "#0f172a" }}>
                  Forgot password?
                </Typography>
                <Typography variant="body2" sx={{ mb: 4, color: "#64748b" }}>
                  Enter your email and we'll send you a reset link.
                </Typography>

                {forgotError && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{forgotError}</Alert>}

                <Box component="form" onSubmit={handleForgotSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  <TextField
                    required fullWidth label="Email address" type="email"
                    value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailOutlinedIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }}
                  />

                  <Button
                    type="submit" fullWidth variant="contained" size="large"
                    disabled={forgotSubmitting}
                    sx={{
                      mt: 1, py: 1.5, borderRadius: 2, fontWeight: 600, fontSize: "0.95rem",
                      background: "linear-gradient(90deg,#0c6ea6 0%,#2ea3f2 100%)",
                      boxShadow: "0 4px 14px rgba(12,110,166,0.3)", textTransform: "none",
                      "&:hover": { background: "linear-gradient(90deg,#0a5f8f 0%,#1a8fd1 100%)" },
                    }}
                  >
                    {forgotSubmitting ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Send reset link"}
                  </Button>

                  <Button
                    variant="text" size="small"
                    onClick={() => { setForgotMode(false); setForgotError(""); }}
                    sx={{ textTransform: "none", color: "#64748b", alignSelf: "center" }}
                  >
                    Back to sign in
                  </Button>
                </Box>
              </>
            )
          ) : (
            /* ── Sign in view ── */
            <>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, color: "#0f172a" }}>
                Welcome back
              </Typography>
              <Typography variant="body2" sx={{ mb: 4, color: "#64748b" }}>
                Sign in to your Involve Interpreter account
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                <TextField
                  required fullWidth label="Email address" type="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }}
                />

                <Box>
                  <TextField
                    required fullWidth label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword((s) => !s)} edge="end" size="small">
                            {showPassword
                              ? <VisibilityOff sx={{ fontSize: 18, color: "#94a3b8" }} />
                              : <Visibility sx={{ fontSize: 18, color: "#94a3b8" }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }}
                  />
                  <Box sx={{ textAlign: "right", mt: 0.75 }}>
                    <Button
                      variant="text" size="small"
                      onClick={() => { setForgotMode(true); setForgotEmail(email); }}
                      sx={{ textTransform: "none", color: "#0c6ea6", fontWeight: 600, fontSize: "0.8rem", p: 0, minWidth: 0 }}
                    >
                      Forgot password?
                    </Button>
                  </Box>
                </Box>

                <Button
                  type="submit" fullWidth variant="contained" size="large"
                  sx={{
                    mt: 0.5, py: 1.5, borderRadius: 2, fontWeight: 600, fontSize: "0.95rem",
                    background: "linear-gradient(90deg,#0c6ea6 0%,#2ea3f2 100%)",
                    boxShadow: "0 4px 14px rgba(12,110,166,0.3)", textTransform: "none",
                    "&:hover": { background: "linear-gradient(90deg,#0a5f8f 0%,#1a8fd1 100%)", boxShadow: "0 6px 20px rgba(12,110,166,0.4)" },
                  }}
                >
                  Sign in
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
