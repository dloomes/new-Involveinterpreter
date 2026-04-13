import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Avatar } from "@mui/material";
import { useAuth } from "../AuthContext";
import UpdateProfileForm from "../pages/UpdateProfile";
import DashboardIcon from "@mui/icons-material/Dashboard";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth"; // import the icons you need

export default function TailLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return null;

  const handleProfileOpen = () => setProfileOpen(true);
  const handleProfileClose = () => setProfileOpen(false);
  const handleLogout = () => {
    logout();
    // add your navigation logic if using react-router
  };

  const menuItems = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/" },
    { text: "Calendar", icon: <CalendarMonthIcon />, path: "/bookings", roles: ["Admin"] },
    { text: "Bookings", icon: <GroupAddIcon />, path: "/bookings", roles: ["Admin"] },
    { text: "My Bookings", icon: <GroupAddIcon />, path: "/bookings", roles: ["Customer"] },
    { text: "Pending Bookings", icon: <GroupAddIcon />, path: "/bookings", roles: ["Customer"] },
    { text: "Cancelled Bookings", icon: <GroupAddIcon />, path: "/bookings", roles: ["Customer"] },
    { text: "Future Bookings", icon: <GroupAddIcon />, path: "/bookings", roles: ["Customer"] },
    { text: "Manage Users", icon: <GroupAddIcon />, path: "/admin/users", roles: ["Admin"] },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`bg-white shadow-lg transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-16"
        }`}
      >
        <div className="h-16 flex items-center justify-center font-bold text-xl">
          {sidebarOpen ? "BSL Portal" : "BP"}
        </div>
        <nav className="flex flex-col p-2 space-y-1">
          {menuItems
            .filter(item => !item.roles || item.roles.some(r => user.roles?.includes(r)))
            .map(item => (
              <a
                key={item.text}
                href={item.path}
                className="flex items-center p-2 rounded hover:bg-gray-100"
              >
                <span className="mr-2">{item.icon}</span>
                {sidebarOpen && item.text}
              </a>
            ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 bg-white shadow">
          <button
            className="text-gray-600"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>

          <div className="flex items-center space-x-4">
            <span className="hidden sm:block">
              Welcome, {user.firstName || user.email}
            </span>
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.email?.[0]?.toUpperCase()}
            </Avatar>
            <button
              className="text-red-500 font-semibold"
              onClick={handleLogout}
            >
              Logout
            </button>
            <button
              className="text-gray-700 font-medium ml-2"
              onClick={handleProfileOpen}
            >
              Edit Profile
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Profile Modal */}
      <UpdateProfileForm open={profileOpen} onClose={handleProfileClose} />
    </div>
  );
}