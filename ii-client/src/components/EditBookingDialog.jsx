import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Divider,
  IconButton,
  CircularProgress,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BlockIcon from "@mui/icons-material/Block";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
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
 * EditBookingDialog
 *
 * Props:
 *  bookingId  number | null  — id of the booking to edit; null = closed
 *  onClose    fn             — close without saving
 *  onSaved    fn             — called after a successful save or cancel
 */
export default function EditBookingDialog({ bookingId, onClose, onSaved }) {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("Admin");
  const [form, setForm] = useState({
    date: "", time: "", durationId: "", bookingType: "",
    contactEmail: "", contactNumber: "", videoUrl: "", addInfo: "",
  });
  const [durations, setDurations] = useState([]);
  const [bookingTypes, setBookingTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const handleCopyUrl = () => {
    if (!form.videoUrl) return;
    navigator.clipboard.writeText(form.videoUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  };

  const open = Boolean(bookingId);

  // Load booking details and lookups when dialog opens
  useEffect(() => {
    if (!open) return;
    setFetchError(null);
    setSaveError(null);
    setConfirmCancel(false);
    setConfirmDecline(false);
    setLoading(true);

    Promise.all([
      api.get(`/bookings/${bookingId}`),
      api.get("/Lookups/durations"),
      api.get("/Lookups/bookingtypes"),
    ])
      .then(([bookingRes, durRes, typeRes]) => {
        const b = bookingRes.data;
        const dateStr = b.bookingDate
          ? new Date(b.bookingDate).toISOString().split("T")[0]
          : "";
        const timeStr = b.bookingTime
          ? new Date(b.bookingTime).toTimeString().slice(0, 5)
          : "";

        setForm({
          date: dateStr,
          time: timeStr,
          durationId: b.durationId ?? "",
          bookingType: b.bookingType ?? "",
          contactEmail: b.contactEmail ?? "",
          contactNumber: b.contactNumber ?? "",
          videoUrl: b.videoUrl ?? "",
          addInfo: b.notes ?? "",
        });
        setDurations(durRes.data);
        setBookingTypes(typeRes.data);
      })
      .catch(() => setFetchError("Failed to load booking details."))
      .finally(() => setLoading(false));
  }, [bookingId, open]);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setLoading(true);
    try {
      await api.put(`/bookings/${bookingId}`, {
        BookingDate: `${form.date}T00:00:00`,
        BookingTime: `${form.date}T${form.time}:00`,
        DurationId: Number(form.durationId) || null,
        BookingType: Number(form.bookingType) || null,
        ContactEmail: form.contactEmail,
        ContactNumber: form.contactNumber,
        VideoUrl: form.videoUrl,
        AddInfo: form.addInfo,
      });
      onSaved();
      onClose();
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDecline = async () => {
    setDeclining(true);
    try {
      await api.patch(`/bookings/${bookingId}/decline`);
      onSaved();
      onClose();
    } catch {
      setSaveError("Failed to decline booking. Please try again.");
      setConfirmDecline(false);
    } finally {
      setDeclining(false);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await api.patch(`/bookings/${bookingId}/cancel`);
      onSaved();
      onClose();
    } catch {
      setSaveError("Failed to cancel booking. Please try again.");
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}
    >
      {/* Decline confirmation overlay */}
      {confirmDecline ? (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
              Decline booking
            </Typography>
            <IconButton size="small" onClick={() => setConfirmDecline(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ pt: 0 }}>
            <Divider sx={{ mb: 2.5 }} />
            <Box
              sx={{
                display: "flex", gap: 2, alignItems: "flex-start",
                bgcolor: "#faf5ff", border: "1px solid #d8b4fe",
                borderRadius: 2, p: 2.5,
              }}
            >
              <BlockIcon sx={{ color: "#7c3aed", flexShrink: 0, mt: 0.2 }} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ color: "#4c1d95", mb: 0.5 }}>
                  Are you sure you want to decline this booking?
                </Typography>
                <Typography variant="body2" sx={{ color: "#4c1d95", opacity: 0.85 }}>
                  The booking will be marked as unfulfilled and the customer will be notified by email.
                </Typography>
              </Box>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              onClick={() => setConfirmDecline(false)}
              variant="outlined"
              size="small"
              disabled={declining}
              sx={{
                borderRadius: 2, textTransform: "none",
                borderColor: "#e2e8f0", color: "#475569",
                "&:hover": { borderColor: "#94a3b8" },
              }}
            >
              Go back
            </Button>
            <Button
              onClick={handleConfirmDecline}
              variant="contained"
              size="small"
              disabled={declining}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 600,
                bgcolor: "#7c3aed",
                "&:hover": { bgcolor: "#6d28d9" },
                boxShadow: "none",
              }}
            >
              {declining ? "Declining…" : "Yes, decline booking"}
            </Button>
          </DialogActions>
        </>
      ) : /* Cancel confirmation overlay */
      confirmCancel ? (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
              Cancel booking
            </Typography>
            <IconButton size="small" onClick={() => setConfirmCancel(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ pt: 0 }}>
            <Divider sx={{ mb: 2.5 }} />
            <Box
              sx={{
                display: "flex", gap: 2, alignItems: "flex-start",
                bgcolor: "#fff7ed", border: "1px solid #fed7aa",
                borderRadius: 2, p: 2.5,
              }}
            >
              <WarningAmberIcon sx={{ color: "#f97316", flexShrink: 0, mt: 0.2 }} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ color: "#9a3412", mb: 0.5 }}>
                  Are you sure you want to cancel this booking?
                </Typography>
                <Typography variant="body2" sx={{ color: "#9a3412", opacity: 0.85 }}>
                  This action cannot be undone. The booking will be marked as cancelled.
                </Typography>
              </Box>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              onClick={() => setConfirmCancel(false)}
              variant="outlined"
              size="small"
              disabled={cancelling}
              sx={{
                borderRadius: 2, textTransform: "none",
                borderColor: "#e2e8f0", color: "#475569",
                "&:hover": { borderColor: "#94a3b8" },
              }}
            >
              Go back
            </Button>
            <Button
              onClick={handleConfirmCancel}
              variant="contained"
              size="small"
              disabled={cancelling}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 600,
                bgcolor: "#dc2626",
                "&:hover": { bgcolor: "#b91c1c" },
                boxShadow: "none",
              }}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel booking"}
            </Button>
          </DialogActions>
        </>
      ) : /* Main edit form */ (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
              Edit booking
            </Typography>
            <IconButton size="small" onClick={onClose} disabled={loading}>
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
              <Box component="form" id="edit-booking-form" onSubmit={handleSave} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {saveError && (
                  <Alert severity="error" sx={{ borderRadius: 2 }}>{saveError}</Alert>
                )}

                {/* Date & time */}
                <Box sx={{ bgcolor: "#fff", borderRadius: 3, border: "1px solid #e2e8f0", p: 2.5 }}>
                  <SectionHeading>Date & time</SectionHeading>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    <TextField
                      required label="Date" type="date" name="date"
                      value={form.date} onChange={handleChange}
                      size="small" InputLabelProps={{ shrink: true }} sx={fieldSx}
                    />
                    <TextField
                      required label="Start time" type="time" name="time"
                      value={form.time} onChange={handleChange}
                      size="small" InputLabelProps={{ shrink: true }} sx={fieldSx}
                    />
                    <TextField
                      select required label="Duration" name="durationId"
                      value={form.durationId} onChange={handleChange}
                      size="small" sx={fieldSx}
                    >
                      {durations.map((d) => (
                        <MenuItem key={d.id} value={d.id}>{d.duration}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select required label="Booking type" name="bookingType"
                      value={form.bookingType} onChange={handleChange}
                      size="small" sx={fieldSx}
                    >
                      {bookingTypes.map((t) => (
                        <MenuItem key={t.id} value={t.id}>{t.bookingType}</MenuItem>
                      ))}
                    </TextField>
                  </Box>
                </Box>

                {/* Contact */}
                <Box sx={{ bgcolor: "#fff", borderRadius: 3, border: "1px solid #e2e8f0", p: 2.5 }}>
                  <SectionHeading>Contact details</SectionHeading>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                    <TextField
                      label="Email" name="contactEmail" type="email" size="small"
                      value={form.contactEmail} onChange={handleChange} sx={fieldSx}
                    />
                    <TextField
                      label="Phone" name="contactNumber" size="small"
                      value={form.contactNumber} onChange={handleChange} sx={fieldSx}
                    />
                  </Box>
                </Box>

                {/* Video link */}
                <Box sx={{ bgcolor: "#fff", borderRadius: 3, border: "1px solid #e2e8f0", p: 2.5 }}>
                  <SectionHeading>Video link details</SectionHeading>
                  <Box
                    sx={{
                      display: "flex", alignItems: "flex-start", gap: 1,
                      bgcolor: "#fff7ed", border: "1px solid #fed7aa",
                      borderRadius: 2, px: 2, py: 1.5, mb: 2,
                    }}
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16, color: "#f97316", mt: 0.15, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: "#9a3412", lineHeight: 1.5 }}>
                      If you have your own link, please paste it here. If not we will provide one for you to use.
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth multiline rows={3} label="Video URL" name="videoUrl" size="small"
                    value={form.videoUrl} onChange={handleChange}
                    placeholder="https://" sx={fieldSx}
                  />
                  <Button
                    size="small"
                    onClick={handleCopyUrl}
                    disabled={!form.videoUrl}
                    startIcon={urlCopied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    sx={{
                      mt: 1,
                      textTransform: "none",
                      fontSize: "0.75rem",
                      color: urlCopied ? "#16a34a" : "#475569",
                      "&:hover": { bgcolor: "#f1f5f9" },
                    }}
                  >
                    {urlCopied ? "Copied!" : "Copy URL"}
                  </Button>
                </Box>

                {/* Notes */}
                <Box sx={{ bgcolor: "#fff", borderRadius: 3, border: "1px solid #e2e8f0", p: 2.5 }}>
                  <SectionHeading>Additional information</SectionHeading>
                  <Box
                    sx={{
                      display: "flex", alignItems: "flex-start", gap: 1,
                      bgcolor: "#fff7ed", border: "1px solid #fed7aa",
                      borderRadius: 2, px: 2, py: 1.5, mb: 2,
                    }}
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16, color: "#f97316", mt: 0.15, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: "#9a3412", lineHeight: 1.5 }}>
                      Please do not include any sensitive personal information in this field.
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth multiline rows={3} label="Additional info"
                    name="addInfo" value={form.addInfo} onChange={handleChange}
                    sx={fieldSx}
                  />
                </Box>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            {/* Left group */}
            <Box sx={{ display: "flex", gap: 1, flex: 1 }}>
              <Button
                onClick={() => setConfirmCancel(true)}
                variant="outlined"
                size="small"
                disabled={loading}
                sx={{
                  borderRadius: 2, textTransform: "none",
                  borderColor: "#fecaca", color: "#dc2626",
                  "&:hover": { bgcolor: "#fee2e2", borderColor: "#dc2626" },
                }}
              >
                Cancel booking
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => setConfirmDecline(true)}
                  variant="outlined"
                  size="small"
                  disabled={loading}
                  sx={{
                    borderRadius: 2, textTransform: "none",
                    borderColor: "#d8b4fe", color: "#7c3aed",
                    "&:hover": { bgcolor: "#faf5ff", borderColor: "#7c3aed" },
                  }}
                >
                  Decline booking
                </Button>
              )}
            </Box>
            <Button
              onClick={onClose}
              variant="outlined"
              size="small"
              disabled={loading}
              sx={{
                borderRadius: 2, textTransform: "none",
                borderColor: "#e2e8f0", color: "#475569",
                "&:hover": { borderColor: "#94a3b8" },
              }}
            >
              Discard
            </Button>
            <Button
              type="submit"
              form="edit-booking-form"
              variant="contained"
              size="small"
              disabled={loading || Boolean(fetchError)}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 600,
                background: "linear-gradient(90deg, #003366 0%, #0057b8 100%)",
                "&:hover": { background: "linear-gradient(90deg, #002244 0%, #0046a0 100%)" },
              }}
            >
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
