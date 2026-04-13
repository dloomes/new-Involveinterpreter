import { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  MenuItem,
  Card,
  CardContent,
  Divider,
  Alert,
  InputAdornment,
} from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import BusinessIcon from "@mui/icons-material/Business";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../AuthContext";

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2,
    bgcolor: "#fff",
  },
};

const SectionHeading = ({ children }) => (
  <Typography
    variant="overline"
    sx={{
      color: "#64748b",
      fontWeight: 700,
      fontSize: "0.7rem",
      letterSpacing: "0.1em",
      mb: 2,
      display: "block",
    }}
  >
    {children}
  </Typography>
);

export default function CreateBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roles?.includes("Admin");
  const [urlCopied, setUrlCopied] = useState(false);

  const handleCopyUrl = () => {
    if (!form.VideoURL) return;
    navigator.clipboard.writeText(form.VideoURL).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  };

  const [form, setForm] = useState({
    ContactEmail: "",
    ContactNumber: "",
    BookingDate: "",
    BookingTime: "",
    AddInfo: "",
    VideoURL: "",
    DurationId: "",
    BookingType: "",
  });

  const [durations, setDurations] = useState([]);
  const [bookingTypes, setBookingTypes] = useState([]);
  const [error, setError] = useState("");

  // Admin — on behalf of
  const [customers, setCustomers] = useState([]);
  const [customerUsers, setCustomerUsers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    api
      .get("/Lookups/durations")
      .then((r) => setDurations(r.data))
      .catch(console.error);
    api
      .get("/Lookups/bookingtypes")
      .then((r) => setBookingTypes(r.data))
      .catch(console.error);
    if (isAdmin) {
      api
        .get("/customers")
        .then((r) => setCustomers(r.data))
        .catch(console.error);
      api
        .get("/users/customer-users")
        .then((r) => setCustomerUsers(r.data))
        .catch(console.error);
    }
  }, [isAdmin]);

  const filteredUsers = selectedCustomerId
    ? customerUsers
        .filter((u) => String(u.companyId) === String(selectedCustomerId))
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`,
          ),
        )
    : [];

  const handleCustomerChange = (e) => {
    setSelectedCustomerId(e.target.value);
    setSelectedUserId("");
    setForm((f) => ({ ...f, ContactEmail: "", ContactNumber: "" }));
  };

  const handleUserChange = (e) => {
    const uid = e.target.value;
    setSelectedUserId(uid);
    const picked = customerUsers.find((u) => u.id === uid);
    if (picked) {
      setForm((f) => ({
        ...f,
        ContactEmail: picked.email ?? f.ContactEmail,
        ContactNumber: picked.phoneNumber ?? f.ContactNumber,
      }));
    }
  };

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isAdmin && !selectedUserId) {
      setError("Please select a customer and user to book on behalf of.");
      return;
    }

    try {
      const selectedCustomer = customers.find(
        (c) => String(c.id) === String(selectedCustomerId),
      );

      const payload = {
        ContactEmail: form.ContactEmail,
        ContactNumber: form.ContactNumber,
        BookingDate: `${form.BookingDate}T00:00:00`,
        BookingTime: `${form.BookingDate}T${form.BookingTime}:00`,
        AddInfo: form.AddInfo,
        VideoUrl: form.VideoURL,
        DurationId: Number(form.DurationId),
        BookingType: Number(form.BookingType),
        ...(isAdmin && {
          UserId: selectedUserId,
          CustId: selectedCustomer?.id ?? null,
        }),
      };

      await api.post("/bookings", payload);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.title ||
          "Failed to create booking. Please try again.",
      );
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ color: "#0f172a", mb: 0.5 }}
        >
          New Booking
        </Typography>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          Fill in the details below to request a BSL interpreter.
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      <form onSubmit={handleFormSubmit}>
        {/* ── Admin: book on behalf of ── */}
        {isAdmin && (
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid #bfdbfe",
              bgcolor: "#eff6ff",
              mb: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <SectionHeading>Book on behalf of</SectionHeading>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <TextField
                  select
                  required
                  fullWidth
                  label="Customer"
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                  sx={fieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BusinessIcon sx={{ color: "#94a3b8", fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                >
                  <MenuItem value="">
                    <em>Select customer…</em>
                  </MenuItem>
                  {[...customers]
                    .sort((a, b) => a.name?.localeCompare(b.name))
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                </TextField>

                <TextField
                  select
                  required
                  fullWidth
                  label="User"
                  value={selectedUserId}
                  onChange={handleUserChange}
                  disabled={!selectedCustomerId}
                  sx={fieldSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlineIcon
                          sx={{ color: "#94a3b8", fontSize: 18 }}
                        />
                      </InputAdornment>
                    ),
                  }}
                >
                  <MenuItem value="">
                    <em>
                      {selectedCustomerId
                        ? "Select user…"
                        : "Select a customer first"}
                    </em>
                  </MenuItem>
                  {filteredUsers.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* ── Booking details ── */}
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid #e2e8f0", mb: 3 }}
        >
          <CardContent sx={{ p: 3 }}>
            <SectionHeading>Booking details</SectionHeading>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                required
                fullWidth
                label="Date"
                type="date"
                name="BookingDate"
                value={form.BookingDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                sx={fieldSx}
              />
              <TextField
                required
                fullWidth
                label="Start time"
                type="time"
                name="BookingTime"
                value={form.BookingTime}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                sx={fieldSx}
              />
              <TextField
                select
                required
                fullWidth
                label="Duration"
                name="DurationId"
                value={form.DurationId}
                onChange={handleChange}
                sx={fieldSx}
              >
                {durations.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.duration}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                required
                fullWidth
                label="Booking type"
                name="BookingType"
                value={form.BookingType}
                onChange={handleChange}
                sx={fieldSx}
              >
                {bookingTypes.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.bookingType}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </CardContent>
        </Card>

        {/* ── Contact details ── */}
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid #e2e8f0", mb: 3 }}
        >
          <CardContent sx={{ p: 3 }}>
            <SectionHeading>Contact details</SectionHeading>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                required
                fullWidth
                label="Email address"
                name="ContactEmail"
                type="email"
                value={form.ContactEmail}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon
                        sx={{ color: "#94a3b8", fontSize: 18 }}
                      />
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
              <TextField
                fullWidth
                label="Phone number"
                name="ContactNumber"
                value={form.ContactNumber}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneOutlinedIcon
                        sx={{ color: "#94a3b8", fontSize: 18 }}
                      />
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
            </Box>
          </CardContent>
        </Card>

        {/* ── URL details ── */}
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid #e2e8f0", mb: 3 }}
        >
          <CardContent>
            <SectionHeading>Video Link Details</SectionHeading>
            <Box
              sx={{
                mt: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                bgcolor: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 2,
                px: 2,
                py: 1.5,
              }}
            >
              <InfoOutlinedIcon
                sx={{ fontSize: 16, color: "#f97316", mt: 0.15, flexShrink: 0 }}
              />
              <Typography
                variant="caption"
                sx={{ color: "#9a3412", lineHeight: 1.5 }}
              >
                If you have your own link, please paste it here. If not we will provide one for you to use
              </Typography>
            </Box>
            <Box sx={{ mt: 2, position: "relative" }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Video URL"
                name="VideoURL"
                value={form.VideoURL}
                onChange={handleChange}
                placeholder="https://"
                sx={fieldSx}
              />
              <Button
                size="small"
                onClick={handleCopyUrl}
                disabled={!form.VideoURL}
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
          </CardContent>
        </Card>

        {/* ── Additional info ── */}
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid #e2e8f0", mb: 3 }}
        >
          <CardContent sx={{ p: 3 }}>
            <SectionHeading>Additional information</SectionHeading>

            <TextField
              fullWidth
              label="Additional info"
              name="AddInfo"
              multiline
              rows={4}
              value={form.AddInfo}
              onChange={handleChange}
              sx={fieldSx}
              placeholder="Please add additional supporting information regarding your booking..."
            />

            <Box
              sx={{
                mt: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                bgcolor: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 2,
                px: 2,
                py: 1.5,
              }}
            >
              <InfoOutlinedIcon
                sx={{ fontSize: 16, color: "#f97316", mt: 0.15, flexShrink: 0 }}
              />
              <Typography
                variant="caption"
                sx={{ color: "#9a3412", lineHeight: 1.5 }}
              >
                Please do not include any sensitive personal information in this
                field.
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* ── Submit ── */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: "none",
              borderColor: "#e2e8f0",
              color: "#475569",
              px: 3,
              "&:hover": { borderColor: "#94a3b8" },
            }}
            onClick={() => window.history.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
              px: 3,
              background: "linear-gradient(90deg, #003366 0%, #0057b8 100%)",
              boxShadow: "0 4px 14px rgba(0,51,102,0.3)",
              "&:hover": {
                background: "linear-gradient(90deg, #002244 0%, #0046a0 100%)",
              },
            }}
          >
            Create booking
          </Button>
        </Box>
      </form>

    </Box>
  );
}
