import BookingTable from "../../components/BookingTable";

export default function CancelledAssignments() {
  return (
    <BookingTable
      title="Cancelled Assignments"
      subtitle="Bookings assigned to you that have been cancelled."
      endpoint="/bookings/interpreter-cancelled"
      rowIdField="bookingId"
      showNewBooking={false}
    />
  );
}
