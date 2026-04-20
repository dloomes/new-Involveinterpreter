import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Divider,
  CircularProgress,
  IconButton,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TranslateIcon from "@mui/icons-material/Translate";
import api from "../../api";
import EditBookingDialog from "../../components/EditBookingDialog";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

// Colour map keyed on lowercase status string
const STATUS_COLOURS = {
 ready:  { bg: "#059669", border: "#047857", chip: "#dcfce7", chipText: "#166534" },
  pending:    { bg: "#d97706", border: "#b45309", chip: "#fff7ed", chipText: "#9a3412" },
  cancelled:  { bg: "#dc2626", border: "#b91c1c", chip: "#fee2e2", chipText: "#991b1b" },
  assigning:  { bg: "#7c3aed", border: "#6d28d9", chip: "#f5f3ff", chipText: "#5b21b6" },
  unfulfilled:  { bg: "#003366", border: "#002244", chip: "#eff6ff", chipText: "#1e40af" },
  complete:  { bg: "#36a1d6", border: "#36a1d6", chip: "#eff6ff", chipText: "#36a1d6" },
};

const DEFAULT_COLOUR = { bg: "#070707", border: "#002244", chip: "#eff6ff", chipText: "#1e40af" };

const colourFor = (status) =>
  STATUS_COLOURS[status?.toLowerCase()] ?? DEFAULT_COLOUR;

const fmt = (dt, opts) => {
  if (!dt) return "—";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", opts);
};

export default function CustCalendar() {
  const [events, setEvents] = useState([]);
  const [legendStatuses, setLegendStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api
      .get("/bookings/calendar-view")
      .then((res) => {
        console.log("Calendar data:", res.data);

        // Derive unique statuses for the legend
        const seen = new Set();
        const statuses = [];
        res.data.forEach((b) => {
          const s = b.status;
          if (s && !seen.has(s)) { seen.add(s); statuses.push(s); }
        });
        setLegendStatuses(statuses);

        const mapped = res.data
          .filter((b) => b.startTime)
          .map((b) => {
            const c = colourFor(b.status);
            return {
              id: String(b.bookingId),
              title: b.fullName || "Booking",
              start: b.startTime,
              end: b.endTime ?? undefined,
              backgroundColor: c.bg,
              borderColor: c.border,
              textColor: "#fff",
              extendedProps: { ...b },
            };
          });

        setEvents(mapped);
      })
      .catch((err) => {
        console.error("Calendar error:", err);
        setError(
          err.response?.status === 404
            ? "Calendar endpoint not found — ensure the API has been redeployed."
            : `Failed to load calendar data (${err.response?.status ?? "network error"}).`
        );
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleEventClick = ({ event }) => setSelected(event.extendedProps);
  const handleSaved = () => { setRefreshKey((k) => k + 1); setLoading(true); };
  const sc = selected ? colourFor(selected.status) : DEFAULT_COLOUR;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ color: "#0f172a", mb: 0.5 }}>
          My Calendar
        </Typography>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          View and manage your upcoming interpreter bookings.
        </Typography>
      </Box>

      {/* Legend */}
      {!loading && !error && legendStatuses.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1,
            mb: 2.5,
            px: 2.5,
            py: 1.75,
            borderRadius: 2.5,
            border: "1px solid #e2e8f0",
            bgcolor: "#fff",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "#64748b", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em", mr: 0.5,
            }}
          >
            Key:
          </Typography>
          {legendStatuses.map((status) => {
            const c = colourFor(status);
            return (
              <Box key={status} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: c.bg, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: "#475569", fontWeight: 500 }}>
                  {status}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Calendar card */}
      <Box
        sx={{
          borderRadius: 3,
          border: "1px solid #e2e8f0",
          bgcolor: "#fff",
          overflow: "hidden",
          "& .fc": { fontFamily: "'Roboto', sans-serif" },
          "& .fc-toolbar-title": { fontSize: "1rem !important", fontWeight: "700 !important", color: "#0f172a" },
          "& .fc-button": {
            bgcolor: "#f8fafc !important", borderColor: "#e2e8f0 !important",
            color: "#475569 !important", borderRadius: "8px !important",
            fontWeight: "600 !important", textTransform: "none !important",
            boxShadow: "none !important", fontSize: "0.8rem !important",
            padding: "4px 12px !important",
            "&:hover": { bgcolor: "#f1f5f9 !important", borderColor: "#cbd5e1 !important" },
          },
          "& .fc-button-active, & .fc-today-button": {
            bgcolor: "#003366 !important", borderColor: "#003366 !important", color: "#fff !important",
          },
          "& .fc-daygrid-day.fc-day-today": { bgcolor: "#eff6ff !important" },
          "& .fc-col-header-cell": { bgcolor: "#f8fafc", borderColor: "#e2e8f0 !important" },
          "& .fc-col-header-cell-cushion": {
            color: "#64748b", fontWeight: 600, fontSize: "0.75rem",
            textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "none !important",
          },
          "& .fc-daygrid-day-number": { color: "#475569", textDecoration: "none !important", fontSize: "0.85rem" },
          "& .fc-event": { borderRadius: "6px !important", fontSize: "0.78rem", cursor: "pointer" },
          "& .fc-toolbar": { px: "16px", pt: "16px" },
        }}
      >
        {error ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
          </Box>
        ) : loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <CircularProgress size={32} sx={{ color: "#003366" }} />
          </Box>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day" }}
            events={events}
            eventClick={handleEventClick}
            height="auto"
            contentHeight={600}
            dayMaxEvents={3}
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            nowIndicator={true}
            slotEventOverlap={false}
            eventDisplay="block"
          />
        )}
      </Box>

      {/* Event detail dialog */}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
            Booking details
          </Typography>
          <IconButton size="small" onClick={() => setSelected(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2 }} />
          {selected && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="body2" sx={{ color: "#64748b" }}>Status</Typography>
                <Chip
                  label={selected.status || "—"}
                  size="small"
                  sx={{ bgcolor: sc.chip, color: sc.chipText, fontWeight: 600, fontSize: "0.72rem", height: 22, border: "none" }}
                />
              </Box>

              {selected.fullName && (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <PersonOutlineIcon sx={{ fontSize: 15, color: "#94a3b8" }} />
                    <Typography variant="body2" sx={{ color: "#64748b" }}>Contact</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={500} sx={{ color: "#0f172a" }}>{selected.fullName}</Typography>
                </Box>
              )}

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <CalendarMonthIcon sx={{ fontSize: 15, color: "#94a3b8" }} />
                  <Typography variant="body2" sx={{ color: "#64748b" }}>Start</Typography>
                </Box>
                <Typography variant="body2" fontWeight={500} sx={{ color: "#0f172a" }}>
                  {fmt(selected.startTime, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <AccessTimeIcon sx={{ fontSize: 15, color: "#94a3b8" }} />
                  <Typography variant="body2" sx={{ color: "#64748b" }}>End</Typography>
                </Box>
                <Typography variant="body2" fontWeight={500} sx={{ color: "#0f172a" }}>
                  {fmt(selected.endTime, { hour: "2-digit", minute: "2-digit" })}
                </Typography>
              </Box>

              {selected.duration && (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="body2" sx={{ color: "#64748b" }}>Duration</Typography>
                  <Typography variant="body2" fontWeight={500} sx={{ color: "#0f172a" }}>{selected.duration}</Typography>
                </Box>
              )}

              {selected.language && (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <TranslateIcon sx={{ fontSize: 15, color: "#94a3b8" }} />
                    <Typography variant="body2" sx={{ color: "#64748b" }}>Language</Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={500} sx={{ color: "#0f172a" }}>{selected.language}</Typography>
                </Box>
              )}

              {(selected.int1 || selected.int2) && (
                <>
                  <Divider />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" sx={{ color: "#64748b" }}>Interpreter(s)</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ color: "#0f172a", textAlign: "right" }}>
                      {[selected.int1, selected.int2].filter(Boolean).join(", ")}
                    </Typography>
                  </Box>
                </>
              )}

            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setSelected(null)}
            variant="outlined"
            size="small"
            sx={{
              borderRadius: 2, textTransform: "none",
              borderColor: "#e2e8f0", color: "#475569",
              "&:hover": { borderColor: "#94a3b8" },
            }}
          >
            Close
          </Button>
          {selected?.status?.toLowerCase() !== "cancelled" && (
            <Button
              variant="contained"
              size="small"
              startIcon={<EditOutlinedIcon fontSize="small" />}
              onClick={() => {
                const id = selected?.bookingId;
                setSelected(null);
                setEditingId(id);
              }}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 600,
                background: "linear-gradient(90deg, #003366 0%, #0057b8 100%)",
                "&:hover": { background: "linear-gradient(90deg, #002244 0%, #0046a0 100%)" },
              }}
            >
              Edit
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <EditBookingDialog
        bookingId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={handleSaved}
      />
    </Box>
  );
}
