import BookingTable from "../../components/BookingTable";

export default function MyAssignments() {
  return (
    <BookingTable
      title="My Assignments"
      subtitle="All bookings you are assigned to."
      endpoint="/bookings/interpreter-bookings"
      rowIdField="bookingId"
      showNewBooking={false}
    />
  );
}
