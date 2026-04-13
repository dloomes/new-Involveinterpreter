import BookingTable from "../../components/BookingTable";

export default function PendingAssignments() {
  return (
    <BookingTable
      title="Pending Assignments"
      subtitle="Bookings assigned to you that are awaiting confirmation."
      endpoint="/bookings/interpreter-pending"
      rowIdField="bookingId"
      showNewBooking={false}
    />
  );
}
