import { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import EditBookingDialog from "../components/EditBookingDialog";
import AssignInterpreterDialog from "../components/AssignInterpreterDialog";
import { useNavigate } from "react-router";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import CloseIcon from "@mui/icons-material/Close";

import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import api from "../api";

const statusStyle = (status) => {
  switch (status?.toLowerCase()) {
    case "confirmed":  return { bg: "#dcfce7", color: "#166534" };
    case "pending":    return { bg: "#fff7ed", color: "#9a3412" };
    case "cancelled":  return { bg: "#fee2e2", color: "#991b1b" };
    case "ready":      return { bg: "#f0fdf4", color: "#15803d" };
    case "completed":  return { bg: "#f3e8ff", color: "#6b21a8" };
    case "assigning":  return { bg: "#fff7ed", color: "#c2410c" };
    default:           return { bg: "#eff6ff", color: "#1e40af" };
  }
};

const fmtTime = (raw) => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const StatCard = ({ icon, label, value, color, bg, loading }) => (
  <Card
    elevation={0}
    sx={{
      borderRadius: 3,
      border: "1px solid #e2e8f0",
      flex: 1,
      minWidth: 150,
      bgcolor: "#fff",
      transition: "box-shadow 0.2s",
      "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.08)" },
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Box
        sx={{
          width: 44, height: 44, borderRadius: 2.5,
          bgcolor: bg, display: "flex", alignItems: "center",
          justifyContent: "center", mb: 2, color,
        }}
      >
        {icon}
      </Box>
      {loading ? (
        <Skeleton width={40} height={36} sx={{ mb: 0.25 }} />
      ) : (
        <Typography variant="h4" fontWeight={700} sx={{ color: "#0f172a", mb: 0.25 }}>
          {value}
        </Typography>
      )}
      <Typography variant="body2" sx={{ color: "#64748b" }}>{label}</Typography>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("Admin");
  const isInterpreter = user?.roles?.includes("Interpreter");

  const [upcoming, setUpcoming] = useState([]);
  const [pending, setPending] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [interpStats, setInterpStats] = useState(null);
  const [interpUpcoming, setInterpUpcoming] = useState([]);
  const [assigning, setAssigning] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    if (isAdmin) {
      Promise.all([
        api.get("/bookings/admin-stats"),
        api.get("/bookings/admin-assigning"),
      ])
        .then(([statsRes, assigningRes]) => {
          setAdminStats(statsRes.data);
          setAssigning(assigningRes.data);
        })
        .catch(console.error)
        .finally(() => setLoadingData(false));
    } else if (isInterpreter) {
      Promise.all([
        api.get("/bookings/interpreter-stats"),
        api.get("/bookings/interpreter-future"),
      ])
        .then(([statsRes, futureRes]) => {
          setInterpStats(statsRes.data);
          setInterpUpcoming(futureRes.data);
        })
        .catch(console.error)
        .finally(() => setLoadingData(false));
    } else {
      Promise.all([
        api.get("/bookings/future-bookings"),
        api.get("/bookings/pending-bookings"),
        api.get("/bookings/my-bookings"),
      ])
        .then(([futureRes, pendingRes, allRes]) => {
          setUpcoming(futureRes.data);
          setPending(pendingRes.data);
          setAllBookings(allRes.data);
        })
        .catch(console.error)
        .finally(() => setLoadingData(false));
    }
  }, [isAdmin, isInterpreter]);

  // Bookings happening this calendar month
  const upcomingAndPending = [
    ...upcoming.map((b) => ({ ...b, _src: "upcoming" })),
    ...pending.filter((p) => !upcoming.some((u) => u.id === p.id)).map((b) => ({ ...b, _src: "pending" })),
  ].sort((a, b) => new Date(a.bookingDate) - new Date(b.bookingDate));

  const thisMonth = allBookings.filter((b) => {
    const d = new Date(b.bookingDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      {/* ── Hero ── */}
      <Box
        sx={{
          borderRadius: 4,
          background: "linear-gradient(135deg, #061926 0%, #0c6ea6 60%, #2ea3f2 100%)",
          color: "#fff",
          p: { xs: 3, sm: 5 },
          mb: 4,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute", width: 320, height: 320, borderRadius: "50%",
            background: "rgba(255,255,255,0.04)", top: -80, right: -80, pointerEvents: "none",
          }}
        />

        <Typography variant="h4" fontWeight={800} sx={{ mb: 1, letterSpacing: "-0.5px" }}>
          {greeting()}, {user?.firstName || user?.email}
        </Typography>

        <Typography variant="body1" sx={{ opacity: 0.7, mb: 4, maxWidth: 480 }}>
          Here's an overview of your BSL interpreter booking activity.
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {!isInterpreter && (
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => navigate("/bookings/new")}
              sx={{
                bgcolor: "#fff", color: "#0c6ea6", fontWeight: 600,
                borderRadius: 2, textTransform: "none", px: 2.5,
                "&:hover": { bgcolor: "#f0f4ff" },
              }}
            >
              New booking
            </Button>
          )}
          {!isInterpreter && (
            <Button
              variant="outlined"
              startIcon={<CalendarMonthIcon />}
              onClick={() => navigate(isAdmin ? "/admincalendar" : "/custcalendar")}
              sx={{
                borderColor: "rgba(255,255,255,0.4)", color: "#fff",
                fontWeight: 600, borderRadius: 2, textTransform: "none", px: 2.5,
                "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
              }}
            >
              View calendar
            </Button>
          )}
          {isInterpreter && (
            <Button
              variant="outlined"
              startIcon={<BookmarkBorderIcon />}
              onClick={() => navigate("/interpreter/bookings")}
              sx={{
                borderColor: "rgba(255,255,255,0.4)", color: "#fff",
                fontWeight: 600, borderRadius: 2, textTransform: "none", px: 2.5,
                "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
              }}
            >
              My assignments
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Stat cards (admin) ── */}
      {isAdmin && (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 4 }}>
          <StatCard
            icon={<BookmarkBorderIcon fontSize="small" />}
            label="Total bookings"
            value={adminStats?.total ?? 0}
            color="#0c6ea6" bg="#eff6ff"
            loading={loadingData}
          />
          <StatCard
            icon={<PendingActionsIcon fontSize="small" />}
            label="Pending"
            value={adminStats?.pending ?? 0}
            color="#d97706" bg="#fffbeb"
            loading={loadingData}
          />
          <StatCard
            icon={<EventAvailableIcon fontSize="small" />}
            label="Upcoming"
            value={adminStats?.upcoming ?? 0}
            color="#059669" bg="#ecfdf5"
            loading={loadingData}
          />
          <StatCard
            icon={<CalendarMonthIcon fontSize="small" />}
            label="This month"
            value={adminStats?.thisMonth ?? 0}
            color="#7c3aed" bg="#f5f3ff"
            loading={loadingData}
          />
        </Box>
      )}

      {/* ── Stat cards (interpreter) ── */}
      {isInterpreter && (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 4 }}>
          <StatCard icon={<BookmarkBorderIcon fontSize="small" />} label="Total assignments" value={interpStats?.total ?? 0} color="#0c6ea6" bg="#eff6ff" loading={loadingData} />
          <StatCard icon={<PendingActionsIcon fontSize="small" />} label="Pending" value={interpStats?.pending ?? 0} color="#d97706" bg="#fffbeb" loading={loadingData} />
          <StatCard icon={<EventAvailableIcon fontSize="small" />} label="Upcoming" value={interpStats?.upcoming ?? 0} color="#059669" bg="#ecfdf5" loading={loadingData} />
          <StatCard icon={<EventBusyIcon fontSize="small" />} label="Cancelled" value={interpStats?.cancelled ?? 0} color="#dc2626" bg="#fee2e2" loading={loadingData} />
        </Box>
      )}

      {/* ── Stat cards (customer only) ── */}
      {!isAdmin && !isInterpreter && (
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 4 }}>
          <StatCard
            icon={<BookmarkBorderIcon fontSize="small" />}
            label="Total bookings"
            value={allBookings.length}
            color="#0c6ea6" bg="#eff6ff"
            loading={loadingData}
          />
          <StatCard
            icon={<PendingActionsIcon fontSize="small" />}
            label="Pending"
            value={pending.length}
            color="#d97706" bg="#fffbeb"
            loading={loadingData}
          />
          <StatCard
            icon={<EventAvailableIcon fontSize="small" />}
            label="Upcoming"
            value={upcoming.length}
            color="#059669" bg="#ecfdf5"
            loading={loadingData}
          />
          <StatCard
            icon={<CalendarMonthIcon fontSize="small" />}
            label="This month"
            value={thisMonth.length}
            color="#7c3aed" bg="#f5f3ff"
            loading={loadingData}
          />
        </Box>
      )}

      {/* ── Upcoming assignments (interpreter) ── */}
      {isInterpreter && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" }, gap: 3, mb: 3 }}>
          <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: "#0f172a" }}>Quick actions</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                {[
                  { label: "My Assignments", path: "/interpreter/bookings" },
                  { label: "Future Assignments", path: "/interpreter/future" },
                  { label: "Pending Assignments", path: "/interpreter/pending" },
                  { label: "Cancelled Assignments", path: "/interpreter/cancelled" },
                ].map(({ label, path }) => (
                  <Button key={path} variant="outlined" size="small" onClick={() => navigate(path)}
                    sx={{ borderRadius: 2, textTransform: "none", borderColor: "#e2e8f0", color: "#475569", fontWeight: 500, "&:hover": { borderColor: "#0c6ea6", color: "#0c6ea6", bgcolor: "#f8fafc" } }}>
                    {label}
                  </Button>
                ))}
              </Box>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
            <CardContent sx={{ p: 3, pb: "12px !important" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>Upcoming assignments</Typography>
                <Button size="small" endIcon={<ChevronRightIcon fontSize="small" />} onClick={() => navigate("/interpreter/future")}
                  sx={{ textTransform: "none", color: "#0c6ea6", fontWeight: 600, fontSize: "0.8rem", minWidth: 0, p: 0 }}>
                  View all
                </Button>
              </Box>
              {loadingData ? (
                [1, 2, 3].map((i) => <Box key={i} sx={{ mb: 1.5 }}><Skeleton height={56} sx={{ borderRadius: 2 }} /></Box>)
              ) : interpUpcoming.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4, color: "#94a3b8" }}>
                  <EventAvailableIcon sx={{ fontSize: 36, mb: 1, opacity: 0.4 }} />
                  <Typography variant="body2">No upcoming assignments</Typography>
                </Box>
              ) : (
                interpUpcoming.slice(0, 4).map((b, i) => {
                  const sc = statusStyle(b.status);
                  return (
                    <Box key={b.bookingId ?? i}>
                      {i > 0 && <Divider sx={{ borderColor: "#f1f5f9" }} />}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, px: 1, borderRadius: 2, cursor: "pointer", "&:hover": { bgcolor: "#f8fafc" } }}
                        onClick={() => navigate("/interpreter/future")}>
                        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: "#eff6ff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#0c6ea6", lineHeight: 1, textTransform: "uppercase" }}>
                            {new Date(b.bookingDate).toLocaleDateString("en-GB", { month: "short" })}
                          </Typography>
                          <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color: "#0c6ea6", lineHeight: 1.2 }}>
                            {new Date(b.bookingDate).getDate()}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: "#0f172a", mb: 0.25 }}>{b.customer || "Booking"}</Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <AccessTimeIcon sx={{ fontSize: 12, color: "#94a3b8" }} />
                            <Typography variant="caption" sx={{ color: "#64748b" }}>
                              {fmtTime(b.bookingTime)}{b.duration ? ` · ${b.duration}` : ""}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip label={b.status || "—"} size="small"
                          sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: "0.68rem", height: 20, border: "none" }} />
                      </Box>
                    </Box>
                  );
                })
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── Needs interpreter assigned (admin) ── */}
      {isAdmin && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #fed7aa", bgcolor: "#fff7ed", mb: 3 }}>
          <CardContent sx={{ p: 3, pb: "16px !important" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: "#ffedd5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PersonSearchIcon sx={{ fontSize: 20, color: "#c2410c" }} />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a", lineHeight: 1.2 }}>
                    Bookings waiting to be assigned
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#92400e" }}>
                    {loadingData ? "Loading…" : `${assigning.length} booking${assigning.length !== 1 ? "s" : ""} awaiting assignment`}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {loadingData ? (
              [1, 2].map((i) => <Skeleton key={i} height={52} sx={{ borderRadius: 2, mb: 1 }} />)
            ) : assigning.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>
                <Typography variant="body2">All bookings have interpreters assigned</Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {assigning.map((b) => (
                  <Box
                    key={b.bookingId}
                    sx={{
                      display: "flex", alignItems: "center", gap: 2,
                      bgcolor: "#fff", borderRadius: 2, border: "1px solid #fed7aa",
                      px: 2, py: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 40, height: 40, borderRadius: 1.5, bgcolor: "#fff7ed",
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#c2410c", lineHeight: 1, textTransform: "uppercase" }}>
                        {new Date(b.bookingDate).toLocaleDateString("en-GB", { month: "short" })}
                      </Typography>
                      <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#c2410c", lineHeight: 1.2 }}>
                        {new Date(b.bookingDate).getDate()}
                      </Typography>
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ color: "#0f172a", mb: 0.1 }}>
                        {b.customer ?? "—"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748b" }}>
                        {b.fullName ?? ""}
                        {b.bookingTime ? ` · ${fmtTime(b.bookingTime)}` : ""}
                        {b.duration ? ` · ${b.duration}` : ""}
                      </Typography>
                    </Box>

                    <Button
                      size="small"
                      onClick={() => setSelectedBooking(b)}
                      sx={{
                        textTransform: "none", fontWeight: 600, color: "#c2410c",
                        borderColor: "#fed7aa", border: "1px solid", borderRadius: 2,
                        px: 1.5, py: 0.5, flexShrink: 0,
                        "&:hover": { bgcolor: "#ffedd5", borderColor: "#f97316" },
                      }}
                    >
                      Open
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {!isInterpreter && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: isAdmin ? "1fr" : "1fr 340px" }, gap: 3 }}>
        {/* ── Upcoming appointments (customer only) ── */}
        {!isAdmin && (
          <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
            <CardContent sx={{ p: 3, pb: "12px !important" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>
                  Upcoming appointments
                </Typography>
                <Button
                  size="small"
                  endIcon={<ChevronRightIcon fontSize="small" />}
                  onClick={() => navigate("/mybookings")}
                  sx={{ textTransform: "none", color: "#0c6ea6", fontWeight: 600, fontSize: "0.8rem", minWidth: 0, p: 0 }}
                >
                  View all
                </Button>
              </Box>

              {loadingData ? (
                [1, 2, 3].map((i) => (
                  <Box key={i} sx={{ mb: 1.5 }}>
                    <Skeleton height={56} sx={{ borderRadius: 2 }} />
                  </Box>
                ))
              ) : upcomingAndPending.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4, color: "#94a3b8" }}>
                  <EventAvailableIcon sx={{ fontSize: 36, mb: 1, opacity: 0.4 }} />
                  <Typography variant="body2">No upcoming appointments</Typography>
                </Box>
              ) : (
                upcomingAndPending.slice(0, 6).map((b, i) => {
                  const sc = statusStyle(b.status || b.bookingStatus);
                  const dest = b._src === "pending" ? "/pendingbookings" : "/futurebookings";
                  return (
                    <Box key={b.id ?? i}>
                      {i > 0 && <Divider sx={{ borderColor: "#f1f5f9" }} />}
                      <Box
                        sx={{
                          display: "flex", alignItems: "center", gap: 2,
                          py: 1.5, px: 1, borderRadius: 2, cursor: "pointer",
                          "&:hover": { bgcolor: "#f8fafc" },
                        }}
                        onClick={() => navigate(dest)}
                      >
                        <Box
                          sx={{
                            width: 44, height: 44, borderRadius: 2,
                            bgcolor: "#eff6ff", display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}
                        >
                          <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#0c6ea6", lineHeight: 1, textTransform: "uppercase" }}>
                            {new Date(b.bookingDate).toLocaleDateString("en-GB", { month: "short" })}
                          </Typography>
                          <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color: "#0c6ea6", lineHeight: 1.2 }}>
                            {new Date(b.bookingDate).getDate()}
                          </Typography>
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: "#0f172a", mb: 0.25 }}>
                            {b.bookingType || "Interpreter booking"}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <AccessTimeIcon sx={{ fontSize: 12, color: "#94a3b8" }} />
                            <Typography variant="caption" sx={{ color: "#64748b" }}>
                              {fmtTime(b.bookingTime)}{b.duration ? ` · ${b.duration}` : ""}
                            </Typography>
                          </Box>
                        </Box>

                        <Chip
                          label={b.status || b.bookingStatus || "—"}
                          size="small"
                          sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: "0.68rem", height: 20, border: "none" }}
                        />
                      </Box>
                    </Box>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Quick actions ── */}
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: "#0f172a" }}>
              Quick actions
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              {[
                { label: "My Bookings", path: isAdmin ? "/allbookings" : "/mybookings" },
                { label: "Pending Bookings", path: isAdmin ? "/admin/pending" : "/pendingbookings" },
                { label: "Future Bookings", path: isAdmin ? "/admin/future" : "/futurebookings" },
                ...(isAdmin ? [{ label: "Manage Users", path: "/admin/users" }] : []),
              ].map(({ label, path }) => (
                <Button
                  key={path}
                  variant="outlined"
                  size="small"
                  onClick={() => navigate(path)}
                  sx={{
                    borderRadius: 2, textTransform: "none",
                    borderColor: "#e2e8f0", color: "#475569", fontWeight: 500,
                    "&:hover": { borderColor: "#0c6ea6", color: "#0c6ea6", bgcolor: "#f8fafc" },
                  }}
                >
                  {label}
                </Button>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>}

      {/* ── Booking detail dialog (assigning card) ── */}
      <Dialog
        open={Boolean(selectedBooking)}
        onClose={() => setSelectedBooking(null)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, border: "1px solid #e2e8f0" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a" }}>Booking details</Typography>
          <IconButton size="small" onClick={() => setSelectedBooking(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Divider sx={{ mb: 2 }} />
          {selectedBooking && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <DetailRow label="Status" value={
                <Chip label={selectedBooking.status || "—"} size="small"
                  sx={{ bgcolor: "#fff7ed", color: "#9a3412", fontWeight: 600, fontSize: "0.72rem", height: 22, border: "none" }} />
              } />
              {selectedBooking.customer && <DetailRow label="Customer" value={selectedBooking.customer} />}
              {selectedBooking.fullName && <DetailRow label="Contact" value={selectedBooking.fullName} />}
              <DetailRow label="Date" value={
                selectedBooking.bookingDate
                  ? new Date(selectedBooking.bookingDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "—"
              } />
              <DetailRow label="Time" value={fmtTime(selectedBooking.bookingTime)} />
              {selectedBooking.duration && <DetailRow label="Duration" value={selectedBooking.duration} />}
              {(selectedBooking.int1 || selectedBooking.int2) && (
                <DetailRow label="Interpreters" value={[selectedBooking.int1, selectedBooking.int2].filter(Boolean).join(", ")} />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setSelectedBooking(null)} variant="outlined" size="small"
            sx={{ borderRadius: 2, textTransform: "none", borderColor: "#e2e8f0", color: "#475569", "&:hover": { borderColor: "#94a3b8" } }}>
            Close
          </Button>
          <Button
            variant="outlined" size="small"
            startIcon={<PersonOutlineIcon fontSize="small" />}
            onClick={() => { const id = selectedBooking.bookingId; setSelectedBooking(null); setAssigningId(id); }}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, borderColor: "#bfdbfe", color: "#1e40af", "&:hover": { bgcolor: "#eff6ff", borderColor: "#93c5fd" } }}
          >
            Assign
          </Button>
          <Button
            variant="contained" size="small"
            startIcon={<EditOutlinedIcon fontSize="small" />}
            onClick={() => { const id = selectedBooking.bookingId; setSelectedBooking(null); setEditingId(id); }}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, background: "linear-gradient(90deg,#0c6ea6 0%,#2ea3f2 100%)", "&:hover": { background: "linear-gradient(90deg,#0a5f8f 0%,#1a8fd1 100%)" } }}
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>

      <EditBookingDialog
        bookingId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => {
          setEditingId(null);
          // Refresh assigning list
          api.get("/bookings/admin-assigning").then((r) => setAssigning(r.data)).catch(console.error);
        }}
      />
      <AssignInterpreterDialog
        bookingId={assigningId}
        onClose={() => setAssigningId(null)}
        onSaved={() => {
          setAssigningId(null);
          api.get("/bookings/admin-assigning").then((r) => setAssigning(r.data)).catch(console.error);
        }}
      />
    </Box>
  );
}

function DetailRow({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="body2" sx={{ color: "#64748b" }}>{label}</Typography>
      {typeof value === "string" ? (
        <Typography variant="body2" fontWeight={500} sx={{ color: "#0f172a", textAlign: "right", maxWidth: "60%" }}>
          {value}
        </Typography>
      ) : value}
    </Box>
  );
}
