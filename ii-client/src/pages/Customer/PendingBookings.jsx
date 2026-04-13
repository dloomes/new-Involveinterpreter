import BookingTable from "../../components/BookingTable";

export default function PendingBookings() {
  return (
    <BookingTable
      title="Pending Bookings"
      subtitle="Bookings awaiting confirmation."
      endpoint="/bookings/pending-bookings"
    />
  );
}
