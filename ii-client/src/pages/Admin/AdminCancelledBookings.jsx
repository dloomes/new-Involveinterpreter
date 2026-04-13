import BookingTable from "../../components/BookingTable";

export default function AdminCancelledBookings() {
  return (
    <BookingTable
      title="Cancelled Bookings"
      subtitle="All cancelled bookings across all customers."
      endpoint="/bookings/admin-cancelled"
      rowIdField="bookingId"
      showNewBooking={false}
    />
  );
}
