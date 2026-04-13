import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  Snackbar,
  Alert,
  Typography,
  Box,
  Avatar,
  Divider,
  IconButton,
  InputAdornment,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import api from "../api";
import { useAuth } from "../AuthContext";

const fieldSx = {
  "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" },
};

const SectionHeading = ({ children }) => (
  <Typography
    variant="overline"
    sx={{ color: "#64748b", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.1em", mb: 2, display: "block" }}
  >
    {children}
  </Typography>
);

export default function UpdateProfileForm({ open, onClose }) {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    currentPassword: "", newPassword: "", confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    if (open) {
      api.get("/auth/me")
        .then((r) => setForm((prev) => ({
          ...prev,
          firstName: r.data.firstName || "",
          lastName: r.data.lastName || "",
          email: r.data.email || "",
          phone: r.data.phone || "",
          currentPassword: "", newPassword: "", confirmPassword: "",
        })))
        .catch(() => showSnackbar("Failed to load profile", "error"));
    }
  }, [open]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const showSnackbar = (message, severity = "success") =>
    setSnackbar({ open: true, message, severity });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      showSnackbar("Passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await api.put("/auth/me", {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
      });
      if (setUser) setUser(res.data);

      if (form.newPassword && form.currentPassword) {
        await api.post("/auth/change-password", {
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        });
      }

      showSnackbar("Profile updated successfully");
      onClose();
    } catch {
      showSnackbar("Failed to update profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const initials = [form.firstName?.[0], form.lastName?.[0]].filter(Boolean).join("").toUpperCase()
    || user?.email?.[0]?.toUpperCase();

  return (
    <>
      <Dialog
        open={open}
        onClose={() => { if (!loading) onClose(); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3, pt: 3, pb: 2,
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar
              sx={{ width: 48, height: 48, bgcolor: "#003366", fontWeight: 700, fontSize: 18 }}
            >
              {initials}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a", lineHeight: 1.3 }}>
                {form.firstName} {form.lastName}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b" }}>
                {form.email}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose} disabled={loading}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: "#f1f5f9" }} />

        <DialogContent sx={{ px: 3, py: 2.5, bgcolor: "#f8fafc" }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

            {/* Personal details */}
            <Box
              sx={{
                bgcolor: "#fff", borderRadius: 3,
                border: "1px solid #e2e8f0", p: 2.5,
              }}
            >
              <SectionHeading>Personal details</SectionHeading>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <TextField
                  label="First name"
                  name="firstName"
                  size="small"
                  value={form.firstName}
                  onChange={handleChange}
                  sx={fieldSx}
                />
                <TextField
                  label="Last name"
                  name="lastName"
                  size="small"
                  value={form.lastName}
                  onChange={handleChange}
                  sx={fieldSx}
                />
              </Box>
              <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  label="Email address"
                  name="email"
                  size="small"
                  value={form.email}
                  disabled
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon sx={{ fontSize: 16, color: "#cbd5e1" }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSx}
                />
                <TextField
                  label="Phone number"
                  name="phone"
                  size="small"
                  value={form.phone}
                  onChange={handleChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneOutlinedIcon sx={{ fontSize: 16, color: "#94a3b8" }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSx}
                />
              </Box>
            </Box>

            {/* Change password */}
            <Box
              sx={{
                bgcolor: "#fff", borderRadius: 3,
                border: "1px solid #e2e8f0", p: 2.5,
              }}
            >
              <SectionHeading>Change password</SectionHeading>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  label="Current password"
                  name="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  size="small"
                  value={form.currentPassword}
                  onChange={handleChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowCurrent((s) => !s)} edge="end">
                          {showCurrent
                            ? <VisibilityOff sx={{ fontSize: 16, color: "#94a3b8" }} />
                            : <Visibility sx={{ fontSize: 16, color: "#94a3b8" }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSx}
                />
                <TextField
                  label="New password"
                  name="newPassword"
                  type={showNew ? "text" : "password"}
                  size="small"
                  value={form.newPassword}
                  onChange={handleChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowNew((s) => !s)} edge="end">
                          {showNew
                            ? <VisibilityOff sx={{ fontSize: 16, color: "#94a3b8" }} />
                            : <Visibility sx={{ fontSize: 16, color: "#94a3b8" }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSx}
                />
                <TextField
                  label="Confirm new password"
                  name="confirmPassword"
                  type="password"
                  size="small"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  error={Boolean(form.confirmPassword && form.newPassword !== form.confirmPassword)}
                  helperText={
                    form.confirmPassword && form.newPassword !== form.confirmPassword
                      ? "Passwords do not match"
                      : ""
                  }
                  sx={fieldSx}
                />
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
              <Button
                onClick={onClose}
                disabled={loading}
                variant="outlined"
                size="small"
                sx={{
                  borderRadius: 2, textTransform: "none",
                  borderColor: "#e2e8f0", color: "#475569",
                  "&:hover": { borderColor: "#94a3b8" },
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={loading}
                sx={{
                  borderRadius: 2, textTransform: "none", fontWeight: 600,
                  background: "linear-gradient(90deg, #003366 0%, #0057b8 100%)",
                  boxShadow: "0 4px 14px rgba(0,51,102,0.25)",
                  "&:hover": { background: "linear-gradient(90deg, #002244 0%, #0046a0 100%)" },
                }}
              >
                {loading ? "Saving…" : "Save changes"}
              </Button>
            </Box>

          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          sx={{ borderRadius: 2, width: "100%" }}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
