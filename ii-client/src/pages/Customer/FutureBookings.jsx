import BookingTable from "../../components/BookingTable";

export default function FutureBookings() {
  return (
    <BookingTable
      title="Future Bookings"
      subtitle="Your upcoming confirmed bookings."
      endpoint="/bookings/future-bookings"
    />
  );
}
