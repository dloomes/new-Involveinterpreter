import BookingTable from "../../components/BookingTable";

export default function MyBookings() {
  return (
    <BookingTable
      title="My Bookings"
      subtitle="All your interpreter booking requests."
      endpoint="/bookings/my-bookings"
    />
  );
}
