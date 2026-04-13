import BookingTable from "../../components/BookingTable";

export default function FutureAssignments() {
  return (
    <BookingTable
      title="Future Assignments"
      subtitle="Your upcoming interpreter bookings."
      endpoint="/bookings/interpreter-future"
      rowIdField="bookingId"
      showNewBooking={false}
    />
  );
}
