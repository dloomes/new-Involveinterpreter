import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Alert,
  Chip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import api from "../../api";
import { dataGridSx } from "../../components/BookingTable";

const buildMonths = () => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    months.push({ key, label, year, monthIndex });
  }
  return months;
};

const pad = (n) => String(n).padStart(2, "0");

const toIsoDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtDate = (raw) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const fmtDateIso = (raw) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return toIsoDate(d);
};

const fmtTime = (raw) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const fmtMins = (m) => (m == null ? "" : String(m));

const statusChip = (outcome) => {
  const styles = {
    "Completed":        { bg: "#dcfce7", color: "#166534" },
    "No show":          { bg: "#fee2e2", color: "#991b1b" },
    "Cancelled (late)": { bg: "#fff7ed", color: "#9a3412" },
  };
  const s = styles[outcome] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <Chip
      label={outcome || "—"}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: "0.72rem", height: 22, border: "none" }}
    />
  );
};

const csvEscape = (v) => {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const toCsv = (rows) => {
  const header = [
    "Booking ID",
    "Company Name",
    "Customer Name (Requestor)",
    "Date booking (requested)",
    "Date of booking",
    "Start time",
    "Type of booking",
    "Status",
    "Interpreter 1",
    "Interpreter 2",
    "Duration booked (mins)",
    "Actual duration (mins)",
    "Chargeable duration (mins)",
    "Charge to customer (ex VAT)",
  ];
  const body = rows.map((r) =>
    [
      r.bookingId,
      r.companyName,
      r.customerName,
      fmtDateIso(r.dateRequested),
      fmtDateIso(r.bookingDate),
      fmtTime(r.bookingTime),
      r.bookingType,
      r.outcome,
      r.interpreter1,
      r.interpreter2,
      r.bookedMins,
      r.actualMins,
      r.chargedMins,
      "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...body].join("\r\n");
};

export default function BillableReport() {
  const months = useMemo(buildMonths, []);
  const [periodKey, setPeriodKey] = useState(months[0].key);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isCustom = periodKey === "custom";

  const { from, to } = useMemo(() => {
    if (isCustom) return { from: customFrom, to: customTo };
    const m = months.find((x) => x.key === periodKey);
    if (!m) return { from: "", to: "" };
    const first = new Date(m.year, m.monthIndex, 1);
    const last = new Date(m.year, m.monthIndex + 1, 0);
    return { from: toIsoDate(first), to: toIsoDate(last) };
  }, [isCustom, customFrom, customTo, periodKey, months]);

  useEffect(() => {
    if (!from || !to) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get("/bookings/billable-report", { params: { from, to } })
      .then((r) => { if (!cancelled) setRows(r.data || []); })
      .catch(() => { if (!cancelled) setError("Failed to load report. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.count += 1;
          if (r.chargedMins != null) acc.chargeable += r.chargedMins;
          return acc;
        },
        { count: 0, chargeable: 0 },
      ),
    [rows],
  );

  const handleExport = () => {
    if (!rows.length) return;
    const csv = toCsv(rows);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const filename = isCustom
      ? `billable-${from}-to-${to}.csv`
      : `billable-${periodKey}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { field: "bookingId", headerName: "ID", width: 80 },
    { field: "companyName", headerName: "Company", flex: 1.2 },
    { field: "customerName", headerName: "Customer", flex: 1 },
    {
      field: "bookingDate",
      headerName: "Date",
      flex: 0.9,
      valueFormatter: (p) => fmtDate(p),
    },
    {
      field: "bookingTime",
      headerName: "Time",
      width: 80,
      valueFormatter: (p) => fmtTime(p),
    },
    { field: "bookingType", headerName: "Type", flex: 0.8 },
    {
      field: "outcome",
      headerName: "Status",
      flex: 0.9,
      renderCell: (p) => statusChip(p.value),
    },
    { field: "interpreter1", headerName: "Int 1", flex: 0.9 },
    { field: "interpreter2", headerName: "Int 2", flex: 0.9 },
    {
      field: "bookedMins",
      headerName: "Booked",
      width: 90,
      valueFormatter: (p) => fmtMins(p),
    },
    {
      field: "actualMins",
      headerName: "Actual",
      width: 90,
      valueFormatter: (p) => fmtMins(p),
    },
    {
      field: "chargedMins",
      headerName: "Chargeable",
      width: 110,
      valueFormatter: (p) => fmtMins(p),
    },
  ];

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight={700} sx={{ color: "#0f172a", mb: 0.5 }}>
          Billable bookings
        </Typography>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          Completed bookings, no-shows, and cancellations made within 48 hours of the booking time (when an interpreter had been assigned).
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center",
          mb: 2.5, p: 2,
          borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff",
        }}
      >
        <TextField
          select
          size="small"
          label="Period"
          value={periodKey}
          onChange={(e) => setPeriodKey(e.target.value)}
          sx={{ minWidth: 220, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
        >
          {months.map((m) => (
            <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>
          ))}
          <MenuItem value="custom">Custom range…</MenuItem>
        </TextField>

        {isCustom && (
          <>
            <TextField
              size="small" label="From" type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
            <TextField
              size="small" label="To" type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="body2" sx={{ color: "#64748b" }}>
          {totals.count} booking{totals.count === 1 ? "" : "s"}
          {totals.count > 0 && ` · ${totals.chargeable} chargeable min`}
        </Typography>

        <Button
          variant="contained"
          startIcon={<FileDownloadIcon />}
          disabled={!rows.length}
          onClick={handleExport}
          sx={{
            borderRadius: 2, textTransform: "none", fontWeight: 600,
            background: "linear-gradient(90deg, #003366 0%, #0057b8 100%)",
            boxShadow: "0 4px 14px rgba(0,51,102,0.25)",
            "&:hover": { background: "linear-gradient(90deg, #002244 0%, #0046a0 100%)" },
          }}
        >
          Export CSV
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{error}</Alert>
      )}

      <Box sx={{ borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff", overflow: "hidden" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.bookingId}
          loading={loading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          autoHeight
          disableRowSelectionOnClick
          sx={{ ...dataGridSx, cursor: "default" }}
        />
      </Box>
    </Box>
  );
}
