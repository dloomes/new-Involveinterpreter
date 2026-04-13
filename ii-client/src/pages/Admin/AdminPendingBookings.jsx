import BookingTable from "../../components/BookingTable";

export default function AdminPendingBookings() {
  return (
    <BookingTable
      title="Pending Bookings"
      subtitle="All bookings awaiting confirmation across all customers."
      endpoint="/bookings/admin-pending"
      rowIdField="bookingId"
    />
  );
}
