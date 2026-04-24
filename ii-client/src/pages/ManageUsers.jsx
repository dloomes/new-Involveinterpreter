import { useEffect, useState } from "react";
import {
  Box, Typography, Button, Chip, Stack, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, Divider, IconButton,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import api from "../api";
import { useAuth } from "../AuthContext";
import { dataGridSx } from "../components/BookingTable";

const roleStyle = {
  Admin:        { bg: "#eff6ff", color: "#1e40af" },
  Customer:     { bg: "#dcfce7", color: "#166534" },
  Interpreter:  { bg: "#fff7ed", color: "#9a3412" },
  "Super Admin":{ bg: "#fee2e2", color: "#991b1b" },
};

const ALL_ROLES = ["Admin", "Customer", "Interpreter", "Super Admin"];

const RoleChip = ({ role }) => {
  const s = roleStyle[role] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <Chip label={role} size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: "0.72rem", border: "none", height: 22 }} />
  );
};

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 2 } };

const emptyCreate = { firstName: "", lastName: "", email: "", phone: "", companyId: "", roles: [] };
const emptyEdit   = { firstName: "", lastName: "", email: "", phone: "", companyId: "", roles: [] };

export default function ManageUsers() {
  const { refreshUser, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyEdit);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, custRes] = await Promise.all([
        api.get("/users/with-roles"),
        api.get("/customers"),
      ]);
      setUsers(usersRes.data);
      setCustomers(custRes.data);
    } catch (err) {
      console.error("Failed loading data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const customerName = (id) => customers.find((c) => c.id === id)?.name ?? (id ? `ID ${id}` : "—");

  // ── Edit ──
  const openEdit = (row) => {
    setEditingUser(row);
    setEditForm({
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      email: row.email ?? "",
      phone: row.phoneNumber ?? "",
      companyId: row.companyId ?? "",
      roles: row.roles ?? [],
    });
  };

  const handleEditSave = async () => {
    try {
      await api.put(`/users/${editingUser.id}`, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone,
        companyId: Number(editForm.companyId) || 0,
        roles: editForm.roles,
      });
      await refreshUser();
      setSnackbar({ open: true, message: "User updated", severity: "success" });
      setEditingUser(null);
      load();
    } catch (err) {
      setSnackbar({ open: true, message: err?.response?.data?.message || "Failed to update user", severity: "error" });
    }
  };

  // ── Create ──
  const handleCreate = async () => {
    try {
      await api.post("/users", {
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        phone: createForm.phone,
        companyId: Number(createForm.companyId) || 0,
        roles: createForm.roles,
      });
      setSnackbar({ open: true, message: "User created", severity: "success" });
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      load();
    } catch (err) {
      const errors = err?.response?.data;
      const msg = Array.isArray(errors)
        ? errors.map((e) => e.description).join(" ")
        : "Failed to create user";
      setSnackbar({ open: true, message: msg, severity: "error" });
    }
  };

  // ── Resend activation ──
  const handleResendActivation = async (userId) => {
    try {
      await api.post(`/users/resend-activation/${userId}`);
      setSnackbar({ open: true, message: "Activation email resent", severity: "success" });
    } catch (err) {
      setSnackbar({ open: true, message: err?.response?.data?.message || "Failed to resend email", severity: "error" });
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setSnackbar({ open: true, message: "User deleted", severity: "success" });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setSnackbar({ open: true, message: err?.response?.data?.message || "Failed to delete user", severity: "error" });
    }
  };

  const columns = [
    { field: "firstName", headerName: "First name", flex: 1 },
    { field: "lastName",  headerName: "Last name",  flex: 1 },
    { field: "email",     headerName: "Email",       flex: 2 },
    {
      field: "companyId", headerName: "Customer", flex: 1.5,
      renderCell: (p) => (
        <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.82rem" }}>
          {customerName(p.value)}
        </Typography>
      ),
    },
    {
      field: "roles", headerName: "Roles", flex: 1.5, sortable: false, filterable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", height: "100%" }}>
          {(p.value ?? []).map((r) => <RoleChip key={r} role={r} />)}
        </Stack>
      ),
    },
    {
      field: "emailConfirmed", headerName: "Status", width: 110, sortable: false, filterable: false,
      renderCell: (p) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Chip
            label={p.value ? "Active" : "Pending"}
            size="small"
            sx={{
              bgcolor: p.value ? "#dcfce7" : "#fff7ed",
              color: p.value ? "#166534" : "#c2410c",
              fontWeight: 600,
              fontSize: "0.72rem",
              border: "none",
              height: 22,
            }}
          />
        </Box>
      ),
    },
    {
      field: "actions", headerName: "", width: 120, sortable: false, filterable: false,
      renderCell: (p) => (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
          {!p.row.emailConfirmed && (
            <IconButton
              size="small"
              title="Resend activation email"
              sx={{ color: "#64748b", "&:hover": { color: "#0057b8" } }}
              onClick={(e) => { e.stopPropagation(); handleResendActivation(p.row.id); }}
            >
              <SendIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          <IconButton size="small" sx={{ color: "#64748b", "&:hover": { color: "#003366" } }}
            onClick={(e) => { e.stopPropagation(); openEdit(p.row); }}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" sx={{ color: "#64748b", "&:hover": { color: "#dc2626" } }}
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.row); }}
            disabled={p.row.id === currentUser?.id}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const CustomerSelect = ({ value, onChange }) => (
    <TextField select fullWidth size="small" label="Customer" value={value} onChange={onChange} sx={fieldSx}>
      <MenuItem value=""><em>None</em></MenuItem>
      {[...customers].sort((a, b) => a.name?.localeCompare(b.name)).map((c) => (
        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
      ))}
    </TextField>
  );

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: "#0f172a", mb: 0.5 }}>Manage Users</Typography>
          <Typography variant="body2" sx={{ color: "#64748b" }}>Add, edit and manage user accounts and roles.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}
          sx={{
            borderRadius: 2, textTransform: "none", fontWeight: 600,
            background: "linear-gradient(90deg,#003366 0%,#0057b8 100%)",
            "&:hover": { background: "linear-gradient(90deg,#002244 0%,#0046a0 100%)" },
          }}>
          Add user
        </Button>
      </Box>

      <Box sx={{ borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff", overflow: "hidden" }}>
        <DataGrid
          rows={users} columns={columns} getRowId={(r) => r.id}
          loading={loading} pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick autoHeight sx={dataGridSx}
        />
      </Box>

      {/* ── Edit dialog ── */}
      <Dialog open={Boolean(editingUser)} onClose={() => setEditingUser(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>Edit user</Typography>
          <IconButton size="small" onClick={() => setEditingUser(null)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2.5 }} />
          {editingUser && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                <TextField label="First name" size="small" value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} sx={fieldSx} />
                <TextField label="Last name" size="small" value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} sx={fieldSx} />
              </Box>
              <TextField label="Email" size="small" value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} sx={fieldSx} />
              <TextField label="Phone" size="small" value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} sx={fieldSx} />
              <CustomerSelect value={editForm.companyId}
                onChange={(e) => setEditForm({ ...editForm, companyId: e.target.value })} />
              <Box>
                <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", mb: 1, display: "block" }}>
                  Roles
                </Typography>
                <Select multiple fullWidth size="small" value={editForm.roles ?? []}
                  onChange={(e) => setEditForm({ ...editForm, roles: e.target.value })}
                  sx={{ borderRadius: 2 }} renderValue={(sel) => sel.join(", ")}>
                  {ALL_ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </Select>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setEditingUser(null)} variant="outlined" size="small"
            sx={{ borderRadius: 2, textTransform: "none", borderColor: "#e2e8f0", color: "#475569", "&:hover": { borderColor: "#94a3b8" } }}>
            Cancel
          </Button>
          <Button onClick={handleEditSave} variant="contained" size="small"
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, background: "linear-gradient(90deg,#003366 0%,#0057b8 100%)", "&:hover": { background: "linear-gradient(90deg,#002244 0%,#0046a0 100%)" } }}>
            Save changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>New user</Typography>
          <IconButton size="small" onClick={() => setCreateOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2.5 }} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField label="First name" size="small" value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} sx={fieldSx} />
              <TextField label="Last name" size="small" value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} sx={fieldSx} />
            </Box>
            <TextField label="Email" size="small" type="email" value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} sx={fieldSx} />
            <TextField label="Phone" size="small" value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} sx={fieldSx} />
            <CustomerSelect value={createForm.companyId}
              onChange={(e) => setCreateForm({ ...createForm, companyId: e.target.value })} />
            <Box>
              <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", mb: 1, display: "block" }}>
                Roles
              </Typography>
              <Select multiple fullWidth size="small" value={createForm.roles}
                onChange={(e) => setCreateForm({ ...createForm, roles: e.target.value })}
                sx={{ borderRadius: 2 }} renderValue={(sel) => sel.join(", ")}>
                {ALL_ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setCreateOpen(false)} variant="outlined" size="small"
            sx={{ borderRadius: 2, textTransform: "none", borderColor: "#e2e8f0", color: "#475569", "&:hover": { borderColor: "#94a3b8" } }}>
            Cancel
          </Button>
          <Button onClick={handleCreate} variant="contained" size="small"
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, background: "linear-gradient(90deg,#003366 0%,#0057b8 100%)", "&:hover": { background: "linear-gradient(90deg,#002244 0%,#0046a0 100%)" } }}>
            Create user
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}>
        <DialogTitle>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>Delete user</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#475569" }}>
            Are you sure you want to delete <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>? This cannot be undone.
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

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
