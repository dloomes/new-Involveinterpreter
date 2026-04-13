namespace IIAPI.Models.DTOs
{
    public class CalendarViewDto
    {
        public int BookingId { get; set; }
        public string? FullName { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public string? Customer { get; set; }
        public string? Duration { get; set; }
        public string? Language { get; set; }
        public string? Status { get; set; }
        public string? Int1 { get; set; }
        public string? Int2 { get; set; }
        public int? BookingStatus { get; set; }
    }
}
