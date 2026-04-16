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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import api from "../api";
import EditBookingDialog from "./EditBookingDialog";
import AssignInterpreterDialog from "./AssignInterpreterDialog";

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
  const isAdmin = user?.roles?.includes("Admin");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    api
      .get(endpoint)
      .then((r) => setRows(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [endpoint, refreshKey]);

  const handleSaved = (message = "Changes saved") => {
    navigate("/", { state: { snack: message } });
  };

  const isCancelled = selected?.status?.toLowerCase() === "cancelled";

  const showCustomer = isAdmin || user?.roles?.includes("Interpreter");
  const columns = [...extraColumns, ...(showCustomer ? [customerColumn] : []), ...baseBookingColumns];

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
          {isAdmin && !isCancelled && (
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
