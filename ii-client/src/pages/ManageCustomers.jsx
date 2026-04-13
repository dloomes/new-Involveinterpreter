import { useEffect, useState } from "react";
import {
  Box, Typography, Button, Chip, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, Divider, Switch,
  FormControlLabel, InputAdornment,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import api from "../api";
import { dataGridSx } from "../components/BookingTable";

const empty = {
  name: "", sectorId: "", contact: "", contactNumber: "", contactEmail: "",
  invoiceName: "", invoiceEmail: "", bSLRateType: "", statusId: "",
  agreedRate: "", vRIATWCharge: "", vRIATWMins: "", vRIATWLink: "", vRIATW: false,
};

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 2 } };

export default function ManageCustomers() {
  const [customers, setCustomers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [rateTypes, setRateTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create mode
  const [form, setForm] = useState(empty);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const load = async () => {
    setLoading(true);
    try {
      const [cust, sec, stat, rt] = await Promise.all([
        api.get("/customers"),
        api.get("/Lookups/sectors"),
        api.get("/Lookups/customerstatuses"),
        api.get("/Lookups/bslratetypes"),
      ]);
      setCustomers(cust.data);
      setSectors(sec.data);
      setStatuses(stat.data);
      setRateTypes(rt.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name ?? "",
      sectorId: row.sectorId ?? "",
      contact: row.contact ?? "",
      contactNumber: row.contactNumber ?? "",
      contactEmail: row.contactEmail ?? "",
      invoiceName: row.invoiceName ?? "",
      invoiceEmail: row.invoiceEmail ?? "",
      bSLRateType: row.bSLRateType ?? "",
      statusId: row.statusId ?? "",
      agreedRate: row.agreedRate ?? "",
      vRIATWCharge: row.vRIATWCharge ?? "",
      vRIATWMins: row.vRIATWMins ?? "",
      vRIATWLink: row.vRIATWLink ?? "",
      vRIATW: row.vRIATW ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        sectorId: form.sectorId || null,
        bSLRateType: form.bSLRateType || null,
        statusId: form.statusId || null,
        agreedRate: form.agreedRate !== "" ? Number(form.agreedRate) : null,
        vRIATWCharge: form.vRIATWCharge !== "" ? Number(form.vRIATWCharge) : null,
      };
      if (editing) {
        await api.put(`/customers/${editing.id}`, payload);
        setSnackbar({ open: true, message: "Customer updated", severity: "success" });
      } else {
        await api.post("/customers", payload);
        setSnackbar({ open: true, message: "Customer created", severity: "success" });
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to save customer", severity: "error" });
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/customers/${deleteTarget.id}`);
      setSnackbar({ open: true, message: "Customer deleted", severity: "success" });
      setDeleteTarget(null);
      load();
    } catch {
      setSnackbar({ open: true, message: "Failed to delete customer", severity: "error" });
    }
  };

  const sectorName = (id) => sectors.find((s) => s.id === id)?.sector ?? "—";
  const statusName = (id) => statuses.find((s) => s.id === id)?.status ?? "—";

  const columns = [
    { field: "name", headerName: "Name", flex: 2 },
    { field: "contactEmail", headerName: "Email", flex: 2 },
    { field: "contactNumber", headerName: "Phone", flex: 1 },
    {
      field: "sectorId", headerName: "Sector", flex: 1,
      renderCell: (p) => sectorName(p.value),
    },
    {
      field: "statusId", headerName: "Status", flex: 1,
      renderCell: (p) => {
        const name = statusName(p.value);
        if (!p.value) return "—";
        const active = name.toLowerCase().includes("active");
        return (
          <Chip
            label={name} size="small"
            sx={{
              bgcolor: active ? "#dcfce7" : "#f1f5f9",
              color: active ? "#166534" : "#475569",
              fontWeight: 600, fontSize: "0.72rem", height: 22,
            }}
          />
        );
      },
    },
    {
      field: "actions", headerName: "", width: 90, sortable: false, filterable: false,
      renderCell: (p) => (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
          <IconButton size="small" sx={{ color: "#64748b", "&:hover": { color: "#003366" } }}
            onClick={(e) => { e.stopPropagation(); openEdit(p.row); }}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" sx={{ color: "#64748b", "&:hover": { color: "#dc2626" } }}
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.row); }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const Field = ({ label, name, type = "text", ...rest }) => (
    <TextField
      fullWidth size="small" label={label} type={type}
      value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      sx={fieldSx} {...rest}
    />
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: "#0f172a", mb: 0.5 }}>
            Manage Customers
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b" }}>
            Add, edit and remove customer organisations.
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<AddIcon />} onClick={openCreate}
          sx={{
            borderRadius: 2, textTransform: "none", fontWeight: 600,
            background: "linear-gradient(90deg,#003366 0%,#0057b8 100%)",
            "&:hover": { background: "linear-gradient(90deg,#002244 0%,#0046a0 100%)" },
          }}
        >
          Add customer
        </Button>
      </Box>

      <Box sx={{ borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff", overflow: "hidden" }}>
        <DataGrid
          rows={customers} columns={columns} getRowId={(r) => r.id}
          loading={loading} pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick autoHeight sx={dataGridSx}
        />
      </Box>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
            {editing ? "Edit customer" : "New customer"}
          </Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2.5 }} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

            {/* Organisation */}
            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Organisation
            </Typography>
            <Field label="Company name" name="name" required />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <TextField select fullWidth size="small" label="Sector" value={form.sectorId}
                onChange={(e) => setForm({ ...form, sectorId: e.target.value })} sx={fieldSx}>
                <MenuItem value=""><em>None</em></MenuItem>
                {sectors.map((s) => <MenuItem key={s.id} value={s.id}>{s.sector}</MenuItem>)}
              </TextField>
              <TextField select fullWidth size="small" label="Status" value={form.statusId}
                onChange={(e) => setForm({ ...form, statusId: e.target.value })} sx={fieldSx}>
                <MenuItem value=""><em>None</em></MenuItem>
                {statuses.map((s) => <MenuItem key={s.id} value={s.id}>{s.status}</MenuItem>)}
              </TextField>
            </Box>

            <Divider />

            {/* Contact */}
            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Contact
            </Typography>
            <Field label="Contact name" name="contact" />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <TextField fullWidth size="small" label="Email" name="contactEmail" value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} sx={fieldSx}
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlinedIcon sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }} />
              <TextField fullWidth size="small" label="Phone" name="contactNumber" value={form.contactNumber}
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} sx={fieldSx}
                InputProps={{ startAdornment: <InputAdornment position="start"><PhoneOutlinedIcon sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }} />
            </Box>

            <Divider />

            {/* Invoice */}
            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Invoice
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <Field label="Invoice name" name="invoiceName" />
              <TextField fullWidth size="small" label="Invoice email" value={form.invoiceEmail}
                onChange={(e) => setForm({ ...form, invoiceEmail: e.target.value })} sx={fieldSx}
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlinedIcon sx={{ fontSize: 16, color: "#94a3b8" }} /></InputAdornment> }} />
            </Box>

            <Divider />

            {/* Rates */}
            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Rates
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <TextField select fullWidth size="small" label="BSL rate type" value={form.bSLRateType}
                onChange={(e) => setForm({ ...form, bSLRateType: e.target.value })} sx={fieldSx}>
                <MenuItem value=""><em>None</em></MenuItem>
                {rateTypes.map((r) => <MenuItem key={r.id} value={r.id}>{r.rateType}</MenuItem>)}
              </TextField>
              <Field label="Agreed rate (£)" name="agreedRate" type="number" />
            </Box>

            <Divider />

            {/* VRI / ATW */}
            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              VRI / ATW
            </Typography>
            <FormControlLabel
              control={<Switch checked={!!form.vRIATW} onChange={(e) => setForm({ ...form, vRIATW: e.target.checked })} size="small" />}
              label={<Typography variant="body2">VRI / ATW enabled</Typography>}
            />
            {form.vRIATW && (
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <Field label="Charge (£)" name="vRIATWCharge" type="number" />
                <Field label="Minutes" name="vRIATWMins" />
                <Field label="Link" name="vRIATWLink" sx={{ ...fieldSx, gridColumn: "span 2" }} />
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" size="small"
            sx={{ borderRadius: 2, textTransform: "none", borderColor: "#e2e8f0", color: "#475569", "&:hover": { borderColor: "#94a3b8" } }}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" size="small"
            sx={{
              borderRadius: 2, textTransform: "none", fontWeight: 600,
              background: "linear-gradient(90deg,#003366 0%,#0057b8 100%)",
              "&:hover": { background: "linear-gradient(90deg,#002244 0%,#0046a0 100%)" },
            }}>
            {editing ? "Save changes" : "Create customer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}>
        <DialogTitle>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>Delete customer</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#475569" }}>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined" size="small"
            sx={{ borderRadius: 2, textTransform: "none", borderColor: "#e2e8f0", color: "#475569" }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} variant="contained" size="small"
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, bgcolor: "#dc2626", "&:hover": { bgcolor: "#b91c1c" } }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
