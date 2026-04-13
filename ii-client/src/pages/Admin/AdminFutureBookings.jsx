import BookingTable from "../../components/BookingTable";

export default function AdminFutureBookings() {
  return (
    <BookingTable
      title="Future Bookings"
      subtitle="All upcoming confirmed bookings across all customers."
      endpoint="/bookings/admin-future"
      rowIdField="bookingId"
    />
  );
}
