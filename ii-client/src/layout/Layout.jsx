import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  CssBaseline,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Tooltip,
  Divider,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import GroupIcon from "@mui/icons-material/Group";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import BusinessIcon from "@mui/icons-material/Business";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import { useAuth } from "../AuthContext";
import UpdateProfileForm from "../pages/UpdateProfile";
import { Outlet, useNavigate, useLocation } from "react-router-dom";

const drawerWidth = 248;

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const { user, logout, hasRole } = useAuth();

  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate("/login");
  };

  const [profileOpen, setProfileOpen] = useState(false);
  const handleProfileOpen = () => {
    handleMenuClose();
    setProfileOpen(true);
  };

  if (!user) return null;

  const menuItems = [
    { text: "Dashboard", icon: <DashboardIcon fontSize="small" />, path: "/" },
    {
      text: "Calendar",
      icon: <CalendarMonthIcon fontSize="small" />,
      path: "/admincalendar",
      roles: ["Admin"],
    },
    {
      text: "Calendar",
      icon: <CalendarMonthIcon fontSize="small" />,
      path: "/custcalendar",
      roles: ["Customer"],
    },
    {
      text: "All Bookings",
      icon: <BookmarkBorderIcon fontSize="small" />,
      path: "/allbookings",
      roles: ["Admin"],
    },
    {
      text: "My Bookings",
      icon: <BookmarkBorderIcon fontSize="small" />,
      path: "/mybookings",
      roles: ["Customer"],
    },
    {
      text: "Pending Bookings",
      icon: <PendingActionsIcon fontSize="small" />,
      path: "/pendingbookings",
      roles: ["Customer"],
    },
    {
      text: "Future Bookings",
      icon: <EventAvailableIcon fontSize="small" />,
      path: "/futurebookings",
      roles: ["Customer"],
    },
    {
      text: "Cancelled Bookings",
      icon: <EventBusyIcon fontSize="small" />,
      path: "/cancelledbookings",
      roles: ["Customer"],
    },

    {
      text: "Pending Bookings",
      icon: <PendingActionsIcon fontSize="small" />,
      path: "/admin/pending",
      roles: ["Admin"],
    },
    {
      text: "Future Bookings",
      icon: <EventAvailableIcon fontSize="small" />,
      path: "/admin/future",
      roles: ["Admin"],
    },
    {
      text: "Cancelled Bookings",
      icon: <EventBusyIcon fontSize="small" />,
      path: "/admin/cancelled",
      roles: ["Admin"],
    },

    {
      text: "Calendar",
      icon: <CalendarMonthIcon fontSize="small" />,
      path: "/interpreter/calendar",
      roles: ["Interpreter"],
    },
    {
      text: "My Assignments",
      icon: <BookmarkBorderIcon fontSize="small" />,
      path: "/interpreter/bookings",
      roles: ["Interpreter"],
    },
    {
      text: "Pending",
      icon: <PendingActionsIcon fontSize="small" />,
      path: "/interpreter/pending",
      roles: ["Interpreter"],
    },
    {
      text: "Future",
      icon: <EventAvailableIcon fontSize="small" />,
      path: "/interpreter/future",
      roles: ["Interpreter"],
    },
    {
      text: "Cancelled",
      icon: <EventBusyIcon fontSize="small" />,
      path: "/interpreter/cancelled",
      roles: ["Interpreter"],
    },
    {
      text: "Billable Report",
      icon: <AssessmentOutlinedIcon fontSize="small" />,
      path: "/admin/reports/billable",
      roles: ["Admin"],
    },
    {
      text: "Manage Customers",
      icon: <BusinessIcon fontSize="small" />,
      path: "/admin/customers",
      roles: ["Admin"],
    },
    {
      text: "Manage Users",
      icon: <ManageAccountsIcon fontSize="small" />,
      path: "/admin/users",
      roles: ["Admin"],
    },
  ];

  const visibleItems = menuItems.filter(
    (item) => !item.roles || item.roles.some((r) => user?.roles?.includes(r)),
  );

  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || user?.email?.[0]?.toUpperCase();

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />

      {/* ── TOP BAR ── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: "#fff",
          borderBottom: "1px solid #e2e8f0",
          color: "#0f172a",
        }}
      >
        <Toolbar sx={{ minHeight: 64 }}>
          <IconButton
            edge="start"
            onClick={() => setOpen((o) => !o)}
            sx={{ mr: 2, color: "#64748b" }}
          >
            {open ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>

          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
            <img
              src="/logo.png"
              alt="Involve Interpreter"
              style={{ height: 32, objectFit: "contain" }}
            />
          </Box>

          <Tooltip title="Account settings">
            <IconButton onClick={handleMenuOpen} sx={{ p: 0.5 }}>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "#0c6ea6",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {initials}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={openMenu}
            onClose={handleMenuClose}
            PaperProps={{
              elevation: 3,
              sx: {
                mt: 1,
                borderRadius: 2,
                minWidth: 200,
                border: "1px solid #e2e8f0",
              },
            }}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleProfileOpen} sx={{ gap: 1.5, py: 1.2 }}>
              <AccountCircleIcon fontSize="small" sx={{ color: "#64748b" }} />
              <Typography variant="body2">My Profile</Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout} sx={{ gap: 1.5, py: 1.2 }}>
              <LogoutIcon fontSize="small" sx={{ color: "#64748b" }} />
              <Typography variant="body2">Sign out</Typography>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* ── SIDEBAR ── */}
      <Drawer
        variant="persistent"
        open={open}
        sx={{
          width: drawerWidth,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: "#061926",
            borderRight: "none",
            color: "#fff",
          },
        }}
      >
        <Toolbar sx={{ minHeight: 64 }} />

        {/* Brand mark */}
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              mb: 1,
            }}
          ></Box>
        </Box>

        <List sx={{ px: 1.5, pt: 0.5 }}>
          {visibleItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <ListItemButton
                key={item.path + item.text}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  py: 1,
                  px: 1.5,
                  color: active ? "#fff" : "#94a3b8",
                  bgcolor: active ? "rgba(255,255,255,0.12)" : "transparent",
                  "&:hover": {
                    bgcolor: active
                      ? "rgba(255,255,255,0.16)"
                      : "rgba(255,255,255,0.06)",
                    color: "#fff",
                  },
                  transition: "all 0.15s ease",
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 34,
                    color: active ? "#2ea3f2" : "#64748b",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: active ? 600 : 400,
                  }}
                />
                {active && (
                  <Box
                    sx={{
                      width: 4,
                      height: 20,
                      borderRadius: 2,
                      bgcolor: "#2ea3f2",
                      ml: 1,
                    }}
                  />
                )}
              </ListItemButton>
            );
          })}
        </List>

        {/* Bottom user pill */}
        <Box sx={{ mt: "auto", px: 2, pb: 3 }}>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 2 }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: "#0c6ea6",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ overflow: "hidden" }}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  color: "#e2e8f0",
                  fontSize: "0.8rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.firstName} {user.lastName}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Drawer>

      <UpdateProfileForm
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      {/* ── PAGE CONTENT ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          bgcolor: "#f8fafc",
          minHeight: "100vh",
          transition: "margin-left 0.2s ease",
        }}
      >
        <Toolbar sx={{ minHeight: 64 }} />
        <Outlet />
      </Box>
    </Box>
  );
}
