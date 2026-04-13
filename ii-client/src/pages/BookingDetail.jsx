import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Typography, Paper } from "@mui/material";
import api from "../api";

export default function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await api.get(`/bookings/${id}`);
        setBooking(response.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchBooking();
  }, [id]);

  if (!booking) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Booking #{booking.bookingId}
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Typography><strong>Contact:</strong> {booking.contactName}</Typography>
        <Typography><strong>Email:</strong> {booking.contactEmail}</Typography>
        <Typography><strong>Phone:</strong> {booking.contactNumber}</Typography>
        <Typography><strong>Date:</strong> {new Date(booking.bookingDate).toLocaleDateString()}</Typography>
        <Typography><strong>Time:</strong> {booking.bookingTime}</Typography>
        <Typography><strong>Status:</strong> {booking.bookingStatus}</Typography>
        <Typography><strong>Notes:</strong> {booking.notes}</Typography>
      </Paper>
    </Box>
  );
}