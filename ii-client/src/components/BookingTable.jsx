import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  TextField,
  MenuItem,
  Alert,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CloseIcon from "@mui/icons-material/Close";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import api from "../api";
import EditBookingDialog from "./EditBookingDialog";
import AssignInterpreterDialog from "./AssignInterpreterDialog";

const CANCEL_REASONS = [
  "No longer required",
  "Deaf attendee cancelled",
  "Meeting rescheduled",
  "Booked in error",
  "Other",
];

const DECLINE_REASONS = [
  "We have no availability",
  "No availability but alternative times",
];

const statusChip = (status) => {
  const s = status?.toLowerCase();
  const map = {
    confirmed: { bg: "#dcfce7", color: "#166534" },
    pending:   { bg: "#fff7ed", color: "#9a3412" },
    cancelled: { bg: "#fee2e2", color: "#991b1b" },
    future:    { bg: "#eff6ff", color: "#1e40af" },
  };
  const style = map[s] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <Chip
      label={status || "—"}
      size="small"
      sx={{ bgcolor: style.bg, color: style.color, fontWeight: 600, fontSize: "0.72rem", height: 22, border: "none" }}
    />
  );
};

const fmtDate = (raw) => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const fmtTime = (raw) => {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export const dataGridSx = {
  border: "none",
  borderRadius: 0,
  "& .MuiDataGrid-columnHeaders": {
    bgcolor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  "& .MuiDataGrid-columnSeparator": { display: "none" },
  "& .MuiDataGrid-cell": {
    borderBottom: "1px solid #f1f5f9",
    fontSize: "0.875rem",
    color: "#334155",
    display: "flex",
    alignItems: "center",
  },
  "& .MuiDataGrid-row": {
    "&:hover": { bgcolor: "#f8fafc" },
    "&.Mui-selected": { bgcolor: "#eff6ff !important" },
  },
  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid #e2e8f0",
    bgcolor: "#f8fafc",
  },
  "& .MuiTablePagination-root": { fontSize: "0.8rem", color: "#64748b" },
  cursor: "pointer",
};

const baseBookingColumns = [
  {
    field: "bookingDate",
    headerName: "Date",
    flex: 1,
    valueGetter: (p) => p || null,
    valueFormatter: (p) => fmtDate(p),
  },
  {
    field: "bookingTime",
    headerName: "Time",
    flex: 1,
    valueGetter: (p) => p || null,
    valueFormatter: (p) => fmtTime(p),
  },
  { field: "duration", headerName: "Duration", flex: 1 },
  {
    field: "status",
    headerName: "Status",
    flex: 1,
    renderCell: (p) => statusChip(p.value),
  },
];

const customerColumn = { field: "customer", headerName: "Customer", flex: 1 };

export default function BookingTable({
  title,
  subtitle,
  endpoint,
  rowIdField = "id",
  extraColumns = [],
  showNewBooking = true,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isAdmin = user?.roles?.includes("Admin");
  const isInterpreter = user?.roles?.includes("Interpreter");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cancellingRow, setCancellingRow] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOther, setCancelOther] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [selectedCancelReason, setSelectedCancelReason] = useState(null);
  const [decliningRow, setDecliningRow] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineAltTimes, setDeclineAltTimes] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declineError, setDeclineError] = useState(null);
  const [selectedDeclineReason, setSelectedDeclineReason] = useState(null);
  const [loggingRow, setLoggingRow] = useState(null);
  const [logMode, setLogMode] = useState("completed");
  const [logMins, setLogMins] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);

  const openCancelDialog = (row) => {
    setCancellingRow(row);
    setCancelReason("");
    setCancelOther("");
    setCancelError(null);
  };

  const closeCancelDialog = () => {
    if (cancelling) return;
    setCancellingRow(null);
  };

  const submitCancel = async () => {
    if (!cancellingRow) return;
    const reason = cancelReason === "Other" ? cancelOther.trim() : cancelReason;
    if (!reason) {
      setCancelError("Please select or enter a reason.");
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      const id = cancellingRow[rowIdField];
      await api.patch(`/bookings/${id}/cancel`, { reason });
      setCancellingRow(null);
      setRefreshKey((k) => k + 1);
      navigate("/", { state: { snack: "Booking cancelled successfully" } });
    } catch {
      setCancelError("Failed to cancel booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const openDeclineDialog = (row) => {
    setDecliningRow(row);
    setDeclineReason("");
    setDeclineAltTimes("");
    setDeclineError(null);
  };

  const closeDeclineDialog = () => {
    if (declining) return;
    setDecliningRow(null);
  };

  const openLogDialog = (row) => {
    setLoggingRow(row);
    setLogMode("completed");
    setLogMins("");
    setLogNotes("");
    setLogError(null);
  };

  const closeLogDialog = () => {
    if (logging) return;
    setLoggingRow(null);
  };

  const submitLog = async () => {
    if (!loggingRow) return;
    const noShow = logMode === "noshow";
    const notes = logNotes.trim();
    const mins = parseInt(logMins, 10);
    if (noShow && !notes) {
      setLogError("Please add a note explaining what happened.");
      return;
    }
    if (!noShow && (!Number.isFinite(mins) || mins <= 0)) {
      setLogError("Please enter the actual minutes you worked.");
      return;
    }
    setLogging(true);
    setLogError(null);
    try {
      const id = loggingRow[rowIdField];
      await api.patch(`/bookings/${id}/log-time`, {
        noShow,
        actualMins: noShow ? null : mins,
        notes: notes || null,
      });
      setLoggingRow(null);
      setRefreshKey((k) => k + 1);
      navigate("/", { state: { snack: noShow ? "No-show logged" : "Time logged" } });
    } catch {
      setLogError("Failed to log time. Please try again.");
    } finally {
      setLogging(false);
    }
  };

  const submitDecline = async () => {
    if (!decliningRow) return;
    if (!declineReason) {
      setDeclineError("Please select a reason.");
      return;
    }
    const needsAlt = declineReason === "No availability but alternative times";
    const altTimes = declineAltTimes.trim();
    if (needsAlt && !altTimes) {
      setDeclineError("Please enter the alternative times you can offer.");
      return;
    }
    setDeclining(true);
    setDeclineError(null);
    try {
      const id = decliningRow[rowIdField];
      await api.patch(`/bookings/${id}/decline`, {
        reason: declineReason,
        alternativeTimes: needsAlt ? altTimes : null,
      });
      setDecliningRow(null);
      setRefreshKey((k) => k + 1);
      navigate("/", { state: { snack: "Customer notified — booking marked unfulfilled" } });
    } catch {
      setDeclineError("Failed to update booking. Please try again.");
    } finally {
      setDeclining(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    api
      .get(endpoint)
      .then((r) => setRows(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [endpoint, refreshKey]);

  useEffect(() => {
    setSelectedCancelReason(null);
    setSelectedDeclineReason(null);
    setSelectedLog(null);
    if (!selected) return;
    const id = selected[rowIdField];
    if (!id) return;
    const status = (selected.status || selected.bookingStatus || "").toString().toLowerCase();
    let cancelled = false;
    api
      .get(`/bookings/${id}`)
      .then((r) => {
        if (cancelled) return;
        if (status === "cancelled") setSelectedCancelReason(r.data?.cancelComments || null);
        if (status === "unfulfilled") setSelectedDeclineReason(r.data?.declineComments || null);
        const d = r.data || {};
        if (d.noShow || d.actualMins != null || d.interpreterNotes) {
          setSelectedLog({
            noShow: Boolean(d.noShow),
            actualMins: d.actualMins ?? null,
            bookedMins: d.bookedMins ?? null,
            chargedMins: d.chargedMins ?? null,
            notes: d.interpreterNotes ?? null,
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selected, rowIdField]);

  const handleSaved = (message = "Changes saved") => {
    navigate("/", { state: { snack: message } });
  };

  const isCancelled = selected?.status?.toLowerCase() === "cancelled";
  const isUnfulfilled = selected?.status?.toLowerCase() === "unfulfilled";
  const bookingDateTime = selected?.bookingDate ? new Date(selected.bookingDate) : null;
  const isPast = bookingDateTime ? bookingDateTime.getTime() < Date.now() : false;
  const alreadyLogged = Boolean(selectedLog);
  const canLogTime = isInterpreter && !isCancelled && !isUnfulfilled && isPast && !alreadyLogged;

  const showCustomer = isAdmin || isInterpreter;

  // Interpreters never cancel bookings; customers/admins can cancel rows that aren't already cancelled.
  const showCancelColumn = !isInterpreter;
  const cancelColumn = {
    field: "__cancel",
    headerName: "",
    width: 110,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    renderCell: (p) => {
      const rowStatus = (p.row.status || p.row.bookingStatus || "").toString().toLowerCase();
      if (rowStatus === "cancelled" || rowStatus === "unfulfilled") return null;
      return (
        <Button
          size="small"
          variant="outlined"
          startIcon={<CancelOutlinedIcon fontSize="small" />}
          onClick={(e) => {
            e.stopPropagation();
            openCancelDialog(p.row);
          }}
          sx={{
            borderRadius: 2, textTransform: "none", fontWeight: 600,
            borderColor: "#fecaca", color: "#dc2626",
            "&:hover": { bgcolor: "#fee2e2", borderColor: "#dc2626" },
          }}
        >
          Cancel
        </Button>
      );
    },
  };

  const columns = [
    ...extraColumns,
    ...(showCustomer ? [customerColumn] : []),
    ...baseBookingColumns,
    ...(showCancelColumn ? [cancelColumn] : []),
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: "#0f172a", mb: 0.5 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: "#64748b" }}>{subtitle}</Typography>
          )}
        </Box>
        {showNewBooking && (
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => navigate("/bookings/new")}
            sx={{
              borderRadius: 2, textTransform: "none", fontWeight: 600,
              background: "linear-gradient(90deg, #003366 0%, #0057b8 100%)",
              boxShadow: "0 4px 14px rgba(0,51,102,0.25)",
              "&:hover": { background: "linear-gradient(90deg, #002244 0%, #0046a0 100%)" },
            }}
          >
            New booking
          </Button>
        )}
      </Box>

      {/* Table card */}
      <Box sx={{ borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff", overflow: "hidden" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row[rowIdField]}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          columnVisibilityModel={isMobile ? { customer: false, duration: false, __cancel: false } : {}}
          onRowClick={(p) => setSelected(p.row)}
          autoHeight
          disableRowSelectionOnClick
          sx={dataGridSx}
        />
      </Box>

      {/* Detail dialog */}
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
              <DetailRow label="Status" value={statusChip(selected.status || selected.bookingStatus)} />
              {selected.customer && <DetailRow label="Customer" value={selected.customer} />}
              {selected.fullName && <DetailRow label="Contact" value={selected.fullName} />}
              {selected.contactEmail && <DetailRow label="Email" value={selected.contactEmail} />}
              <DetailRow
                label="Date"
                icon={<CalendarMonthIcon sx={{ fontSize: 15, color: "#94a3b8" }} />}
                value={fmtDate(selected.bookingDate)}
              />
              <DetailRow
                label="Time"
                icon={<AccessTimeIcon sx={{ fontSize: 15, color: "#94a3b8" }} />}
                value={fmtTime(selected.bookingTime)}
              />
              {selected.duration && <DetailRow label="Duration" value={selected.duration} />}
              {(selected.int1 || selected.int2) && (
                <DetailRow label="Interpreters" value={[selected.int1, selected.int2].filter(Boolean).join(", ")} />
              )}
              {selected.notes && <DetailRow label="Notes" value={selected.notes} />}
              {isCancelled && selectedCancelReason && (
                <DetailRow label="Cancellation reason" value={selectedCancelReason} />
              )}
              {isUnfulfilled && selectedDeclineReason && (
                <DetailRow label="Reason" value={selectedDeclineReason} />
              )}
              {selectedLog?.noShow && (
                <DetailRow label="Outcome" value="Customer/patient no show" />
              )}
              {selectedLog && !selectedLog.noShow && selectedLog.actualMins != null && (
                <DetailRow label="Actual time" value={`${selectedLog.actualMins} min`} />
              )}
              {selectedLog && selectedLog.chargedMins != null && (
                <DetailRow label="Charged" value={`${selectedLog.chargedMins} min`} />
              )}
              {selectedLog?.notes && (
                <DetailRow label="Interpreter notes" value={selectedLog.notes} />
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
          {isAdmin && !isCancelled && !isUnfulfilled && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<PersonOutlineIcon fontSize="small" />}
              onClick={() => {
                const id = selected[rowIdField];
                setSelected(null);
                setAssigningId(id);
              }}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 600,
                borderColor: "#bfdbfe", color: "#1e40af",
                "&:hover": { bgcolor: "#eff6ff", borderColor: "#93c5fd" },
              }}
            >
              Assign
            </Button>
          )}
          {isAdmin && !isCancelled && !isUnfulfilled && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<CancelOutlinedIcon fontSize="small" />}
              onClick={() => {
                const row = selected;
                setSelected(null);
                openDeclineDialog(row);
              }}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 600,
                borderColor: "#fde68a", color: "#b45309",
                "&:hover": { bgcolor: "#fffbeb", borderColor: "#fcd34d" },
              }}
            >
              Unable to allocate
            </Button>
          )}
          {canLogTime && (
            <Button
              variant="contained"
              size="small"
              startIcon={<TimerOutlinedIcon fontSize="small" />}
              onClick={() => {
                const row = selected;
                setSelected(null);
                openLogDialog(row);
              }}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 600,
                background: "linear-gradient(90deg, #0f766e 0%, #14b8a6 100%)",
                "&:hover": { background: "linear-gradient(90deg, #115e59 0%, #0d9488 100%)" },
              }}
            >
              Log time
            </Button>
          )}
          {!isInterpreter && !isCancelled && !isUnfulfilled && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<CancelOutlinedIcon fontSize="small" />}
              onClick={() => {
                const row = selected;
                setSelected(null);
                openCancelDialog(row);
              }}
              sx={{
                borderRadius: 2, textTransform: "none", fontWeight: 600,
                borderColor: "#fecaca", color: "#dc2626",
                "&:hover": { bgcolor: "#fee2e2", borderColor: "#dc2626" },
              }}
            >
              Cancel
            </Button>
          )}
          {!isCancelled && (
            <Button
              variant="contained"
              size="small"
              startIcon={<EditOutlinedIcon fontSize="small" />}
              onClick={() => {
                const id = selected[rowIdField];
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

      {/* Edit / cancel dialog */}
      <EditBookingDialog
        bookingId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={handleSaved}
      />

      {/* Assign interpreters dialog */}
      <AssignInterpreterDialog
        bookingId={assigningId}
        onClose={() => setAssigningId(null)}
        onSaved={() => handleSaved("Interpreters assigned successfully")}
      />

      {/* Cancel reason dialog */}
      <Dialog
        open={Boolean(cancellingRow)}
        onClose={closeCancelDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
            Cancel booking
          </Typography>
          <IconButton size="small" onClick={closeCancelDialog} disabled={cancelling}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2.5 }} />
          <Box
            sx={{
              display: "flex", gap: 2, alignItems: "flex-start",
              bgcolor: "#fff7ed", border: "1px solid #fed7aa",
              borderRadius: 2, p: 2, mb: 2.5,
            }}
          >
            <WarningAmberIcon sx={{ color: "#f97316", flexShrink: 0, mt: 0.2 }} />
            <Typography variant="body2" sx={{ color: "#9a3412" }}>
              This action cannot be undone. Please select a reason for cancellation.
            </Typography>
          </Box>

          {cancelError && (
            <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{cancelError}</Alert>
          )}

          <TextField
            select fullWidth size="small" label="Reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          >
            {CANCEL_REASONS.map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </TextField>

          {cancelReason === "Other" && (
            <TextField
              fullWidth size="small" multiline rows={2}
              label="Please specify"
              value={cancelOther}
              onChange={(e) => setCancelOther(e.target.value)}
              sx={{ mt: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={closeCancelDialog}
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
            onClick={submitCancel}
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
            {cancelling ? "Cancelling…" : "Confirm cancellation"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unable-to-allocate dialog (admin) */}
      <Dialog
        open={Boolean(decliningRow)}
        onClose={closeDeclineDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
            Unable to allocate
          </Typography>
          <IconButton size="small" onClick={closeDeclineDialog} disabled={declining}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2.5 }} />
          <Box
            sx={{
              display: "flex", gap: 2, alignItems: "flex-start",
              bgcolor: "#fff7ed", border: "1px solid #fed7aa",
              borderRadius: 2, p: 2, mb: 2.5,
            }}
          >
            <WarningAmberIcon sx={{ color: "#f97316", flexShrink: 0, mt: 0.2 }} />
            <Typography variant="body2" sx={{ color: "#9a3412" }}>
              The booking will be marked unfulfilled and the customer will be notified by email.
            </Typography>
          </Box>

          {declineError && (
            <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{declineError}</Alert>
          )}

          <TextField
            select fullWidth size="small" label="Reason"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          >
            {DECLINE_REASONS.map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </TextField>

          {declineReason === "No availability but alternative times" && (
            <TextField
              fullWidth size="small" multiline rows={3}
              label="Alternative times to offer"
              placeholder="e.g. Tue 5 May 10:00–12:00, Wed 6 May 14:00–16:00"
              value={declineAltTimes}
              onChange={(e) => setDeclineAltTimes(e.target.value)}
              sx={{ mt: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={closeDeclineDialog}
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
            onClick={submitDecline}
            variant="contained"
            size="small"
            disabled={declining}
            sx={{
              borderRadius: 2, textTransform: "none", fontWeight: 600,
              bgcolor: "#b45309",
              "&:hover": { bgcolor: "#92400e" },
              boxShadow: "none",
            }}
          >
            {declining ? "Sending…" : "Notify customer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Log-time dialog (interpreter) */}
      <Dialog
        open={Boolean(loggingRow)}
        onClose={closeLogDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
            Log time
          </Typography>
          <IconButton size="small" onClick={closeLogDialog} disabled={logging}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2.5 }} />

          {logError && (
            <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{logError}</Alert>
          )}

          <TextField
            select fullWidth size="small" label="Outcome"
            value={logMode}
            onChange={(e) => setLogMode(e.target.value)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          >
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="noshow">Customer/patient no show</MenuItem>
          </TextField>

          {logMode === "completed" && (
            <>
              <TextField
                fullWidth size="small" type="number"
                label="Actual time spent (minutes)"
                value={logMins}
                onChange={(e) => setLogMins(e.target.value)}
                inputProps={{ min: 1 }}
                sx={{ mt: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
              <Typography variant="caption" sx={{ color: "#64748b", display: "block", mt: 1 }}>
                If this is longer than the booked duration the customer is charged for the actual time; otherwise they are charged for the booked duration.
              </Typography>
              <TextField
                fullWidth size="small" multiline rows={2}
                label="Notes (optional)"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                sx={{ mt: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </>
          )}

          {logMode === "noshow" && (
            <>
              <Box
                sx={{
                  display: "flex", gap: 2, alignItems: "flex-start",
                  bgcolor: "#fff7ed", border: "1px solid #fed7aa",
                  borderRadius: 2, p: 2, mt: 2,
                }}
              >
                <WarningAmberIcon sx={{ color: "#f97316", flexShrink: 0, mt: 0.2 }} />
                <Typography variant="body2" sx={{ color: "#9a3412" }}>
                  The customer will be charged for the full booked duration. Please add a note explaining what happened.
                </Typography>
              </Box>
              <TextField
                fullWidth size="small" multiline rows={3}
                label="Notes"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                sx={{ mt: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={closeLogDialog}
            variant="outlined"
            size="small"
            disabled={logging}
            sx={{
              borderRadius: 2, textTransform: "none",
              borderColor: "#e2e8f0", color: "#475569",
              "&:hover": { borderColor: "#94a3b8" },
            }}
          >
            Go back
          </Button>
          <Button
            onClick={submitLog}
            variant="contained"
            size="small"
            disabled={logging}
            sx={{
              borderRadius: 2, textTransform: "none", fontWeight: 600,
              background: "linear-gradient(90deg, #0f766e 0%, #14b8a6 100%)",
              "&:hover": { background: "linear-gradient(90deg, #115e59 0%, #0d9488 100%)" },
              boxShadow: "none",
            }}
          >
            {logging ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function DetailRow({ label, value, icon }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {icon}
        <Typography variant="body2" sx={{ color: "#64748b" }}>{label}</Typography>
      </Box>
      {typeof value === "string" ? (
        <Typography variant="body2" fontWeight={500} sx={{ color: "#0f172a", textAlign: "right", maxWidth: "60%" }}>
          {value}
        </Typography>
      ) : (
        value
      )}
    </Box>
  );
}
