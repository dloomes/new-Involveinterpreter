import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider} from "./AuthContext";
import {useAuth} from "./AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import BookingDetail from "./pages/BookingDetail";
import CreateBooking from "./pages/CreateBooking";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import Layout from "./layout/Layout";
import RequireRole from "./components/RequireRole";
import ManageUsers from "./pages/ManageUsers";
import ManageCustomers from "./pages/ManageCustomers";
import AdminPendingBookings from "./pages/Admin/AdminPendingBookings";
import AdminFutureBookings from "./pages/Admin/AdminFutureBookings";
import AdminCancelledBookings from "./pages/Admin/AdminCancelledBookings";
import BillableReport from "./pages/Admin/BillableReport";
import AllBookings from "./pages/AllBookings";
import MyBookings from "./pages/Customer/MyBookings";
import PendingBookings from "./pages/Customer/PendingBookings";
import CancelledBookings from "./pages/Customer/CancelledBookings";
import FutureBookings from "./pages/Customer/FutureBookings";
import CustCalendar from "./pages/Customer/custcalendar";
import AdminCalendar from "./pages/admincalendar";
import ResetPassword from "./pages/ResetPassword";
import MyAssignments from "./pages/Interpreter/MyAssignments";
import FutureAssignments from "./pages/Interpreter/FutureAssignments";
import PendingAssignments from "./pages/Interpreter/PendingAssignments";
import CancelledAssignments from "./pages/Interpreter/CancelledAssignments";
import Activate from "./pages/Activate";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return children;
}

  const theme = createTheme ({
    palette: {
      primary: {main: "#003366"},
      secondary: {main: "#fa8072"}
    },
    typography: {
      fontFamily: "'Open Sans', 'Roboto', sans-serif",
      warningText: {
        color:"red"
      }

    },
components: {
    MuiTypography: {
      variants: [
        {
          props: { variant: "warningText" },
          style: {
            color: "red",
            fontWeight: 500,
            fontSize: "0.875rem",
            fontStyle: "italic"
          }
        }
      ]
    }
  }
  });

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/activate" element={<Activate />} />

          <Route
            element={<PrivateRoute><Layout /></PrivateRoute>}
            >
          
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>}/>
          <Route path="/bookings" element={<RequireRole roles={["Customer"]}><Bookings /></RequireRole>} />
          <Route path="/mybookings" element={<RequireRole roles={["Customer"]}><MyBookings /></RequireRole>} />
          <Route path="/pendingbookings" element={<RequireRole roles={["Customer"]}><PendingBookings /></RequireRole>} />
          <Route path="/cancelledbookings" element={<RequireRole roles={["Customer"]}><CancelledBookings /></RequireRole>} />
          <Route path="/futurebookings" element={<RequireRole roles={["Customer"]}><FutureBookings /></RequireRole>} />
          <Route path="/custcalendar" element={<RequireRole roles={["Customer"]}><CustCalendar /></RequireRole>} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
          <Route path="/bookings/new" element={<CreateBooking />} />
          <Route path="/admin/users" element={<RequireRole roles={["Admin"]}><ManageUsers /></RequireRole>}></Route>
          <Route path="/admin/customers" element={<RequireRole roles={["Admin"]}><ManageCustomers /></RequireRole>}></Route>
          <Route path="/admin/pending" element={<RequireRole roles={["Admin"]}><AdminPendingBookings /></RequireRole>} />
          <Route path="/admin/future" element={<RequireRole roles={["Admin"]}><AdminFutureBookings /></RequireRole>} />
          <Route path="/admin/cancelled" element={<RequireRole roles={["Admin"]}><AdminCancelledBookings /></RequireRole>} />
          <Route path="/admin/reports/billable" element={<RequireRole roles={["Admin"]}><BillableReport /></RequireRole>} />
          <Route path="/allbookings" element={<RequireRole roles={["Admin"]}><AllBookings /></RequireRole>}></Route>
          <Route path="/admincalendar" element={<RequireRole roles={["Admin"]}>< AdminCalendar /></RequireRole>}></Route>
          <Route path="/interpreter/bookings" element={<RequireRole roles={["Interpreter"]}><MyAssignments /></RequireRole>} />
          <Route path="/interpreter/future" element={<RequireRole roles={["Interpreter"]}><FutureAssignments /></RequireRole>} />
          <Route path="/interpreter/pending" element={<RequireRole roles={["Interpreter"]}><PendingAssignments /></RequireRole>} />
          <Route path="/interpreter/cancelled" element={<RequireRole roles={["Interpreter"]}><CancelledAssignments /></RequireRole>} />
          </Route>
          </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;