import { IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import BookingTable from "../components/BookingTable";

const adminColumns = [
  { field: "bookingId", headerName: "ID", width: 70 },
  { field: "fullName", headerName: "Contact", flex: 1 },
  { field: "customer", headerName: "Customer", flex: 1 },
  { field: "int1", headerName: "Int 1", flex: 1 },
  { field: "int2", headerName: "Int 2", flex: 1 },
  {
    field: "actions",
    headerName: "",
    width: 90,
    sortable: false,
    filterable: false,
    renderCell: (params) => (
      <>
        <IconButton
          size="small"
          sx={{ color: "#64748b", "&:hover": { color: "#003366" } }}
          onClick={(e) => { e.stopPropagation(); console.log("Edit", params.row.bookingId); }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          sx={{ color: "#64748b", "&:hover": { color: "#dc2626" } }}
          onClick={(e) => { e.stopPropagation(); console.log("Delete", params.row.bookingId); }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </>
    ),
  },
];

export default function Bookings() {
  return (
    <BookingTable
      title="Bookings"
      subtitle="Manage all BSL interpreter bookings."
      endpoint="/bookings/details"
      rowIdField="bookingId"
      extraColumns={adminColumns}
    />
  );
}
