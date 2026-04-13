import BookingTable from "../../components/BookingTable";

export default function CancelledBookings() {
  return (
    <BookingTable
      title="Cancelled Bookings"
      subtitle="Bookings that have been cancelled."
      endpoint="/bookings/cancelled-bookings"
      showNewBooking={false}
    />
  );
}
