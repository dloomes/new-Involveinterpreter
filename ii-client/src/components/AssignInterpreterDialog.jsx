import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import api from "../api";

const fieldSx = {
  "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" },
};

const SectionHeading = ({ children }) => (
  <Typography
    variant="overline"
    sx={{
      color: "#64748b", fontWeight: 700, fontSize: "0.7rem",
      letterSpacing: "0.1em", mb: 1.5, display: "block",
    }}
  >
    {children}
  </Typography>
);

/**
 * AssignInterpreterDialog
 *
 * Props:
 *  bookingId  number | null  — id of the booking; null = closed
 *  onClose    fn
 *  onSaved    fn             — called after successful assignment
 */
export default function AssignInterpreterDialog({ bookingId, onClose, onSaved }) {
  const [interpreters, setInterpreters] = useState([]);
  const [interp1, setInterp1] = useState("");
  const [interp2, setInterp2] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const open = Boolean(bookingId);

  useEffect(() => {
    if (!open) return;
    setFetchError(null);
    setSaveError(null);
    setLoading(true);

    api.get(`/bookings/${bookingId}/available-interpreters`)
      .then((res) => {
        setInterpreters(res.data.interpreters ?? []);
        setInterp1(res.data.currentInterpreter1 ?? "");
        setInterp2(res.data.currentInterpreter2 ?? "");
      })
      .catch(() => setFetchError("Failed to load interpreters."))
      .finally(() => setLoading(false));
  }, [bookingId, open]);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await api.put(`/bookings/${bookingId}/assign-interpreters`, {
        Interpreter1: interp1 || null,
        Interpreter2: interp2 || null,
      });
      onSaved();
      onClose();
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const interpName = (id) => {
    if (!id) return "";
    const i = interpreters.find((x) => x.id === id);
    return i ? `${i.firstName} ${i.lastName}` : id;
  };

  // Prevent assigning same interpreter to both slots
  const slot2Options = interpreters.filter((i) => !interp1 || i.id !== interp1);
  const slot1Options = interpreters.filter((i) => !interp2 || i.id !== interp2);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PersonOutlineIcon sx={{ color: "#003366", fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
            Assign interpreters
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={saving}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0, bgcolor: "#f8fafc" }}>
        <Divider sx={{ mb: 2.5 }} />

        {fetchError ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>{fetchError}</Alert>
        ) : loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress size={28} sx={{ color: "#003366" }} />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {saveError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>{saveError}</Alert>
            )}

            <Box sx={{ bgcolor: "#fff", borderRadius: 3, border: "1px solid #e2e8f0", p: 2.5 }}>
              <SectionHeading>Interpreter assignment</SectionHeading>

              <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 2 }}>
                Interpreters marked as <strong>busy</strong> have another booking on this date but can still be assigned.
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Slot 1 */}
                <FormControl fullWidth size="small" sx={fieldSx}>
                  <InputLabel>Interpreter 1</InputLabel>
                  <Select
                    value={interp1}
                    label="Interpreter 1"
                    onChange={(e) => setInterp1(e.target.value)}
                  >
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {slot1Options.map((i) => (
                      <MenuItem key={i.id} value={i.id}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                          <span>{i.firstName} {i.lastName}</span>
                          {!i.available && (
                            <Chip
                              label="busy"
                              size="small"
                              sx={{ ml: 1, height: 18, fontSize: "0.65rem", bgcolor: "#fff7ed", color: "#9a3412", border: "none" }}
                            />
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Slot 2 */}
                <FormControl fullWidth size="small" sx={fieldSx}>
                  <InputLabel>Interpreter 2</InputLabel>
                  <Select
                    value={interp2}
                    label="Interpreter 2"
                    onChange={(e) => setInterp2(e.target.value)}
                  >
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {slot2Options.map((i) => (
                      <MenuItem key={i.id} value={i.id}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                          <span>{i.firstName} {i.lastName}</span>
                          {!i.available && (
                            <Chip
                              label="busy"
                              size="small"
                              sx={{ ml: 1, height: 18, fontSize: "0.65rem", bgcolor: "#fff7ed", color: "#9a3412", border: "none" }}
                            />
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Current assignment summary */}
            {(interp1 || interp2) && (
              <Box sx={{ bgcolor: "#eff6ff", borderRadius: 2, p: 2, border: "1px solid #bfdbfe" }}>
                <Typography variant="caption" sx={{ color: "#1e40af", fontWeight: 600, display: "block", mb: 0.5 }}>
                  Assignment preview
                </Typography>
                {interp1 && (
                  <Typography variant="caption" sx={{ color: "#1e3a5f", display: "block" }}>
                    1. {interpName(interp1)}
                  </Typography>
                )}
                {interp2 && (
                  <Typography variant="caption" sx={{ color: "#1e3a5f", display: "block" }}>
                    2. {interpName(interp2)}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="small"
          disabled={saving}
          sx={{
            borderRadius: 2, textTransform: "none",
            borderColor: "#e2e8f0", color: "#475569",
            "&:hover": { borderColor: "#94a3b8" },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="small"
          disabled={saving || loading || Boolean(fetchError)}
          sx={{
            borderRadius: 2, textTransform: "none", fontWeight: 600,
            background: "linear-gradient(90deg, #003366 0%, #0057b8 100%)",
            "&:hover": { background: "linear-gradient(90deg, #002244 0%, #0046a0 100%)" },
          }}
        >
          {saving ? "Saving…" : "Save assignment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
