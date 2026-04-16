namespace IIAPI.Models.DTOs
{
    public class UpdateBookingDto
    {
        public DateTime BookingDate { get; set; }
        public DateTime BookingTime { get; set; }
        public int? DurationId { get; set; }
        public int? BookingType { get; set; }
        public string? ContactEmail { get; set; }
        public string? ContactNumber { get; set; }
        public string? AddInfo { get; set; }
        public string? VideoUrl { get; set; }
        public string? DeafName { get; set; }
        public string? ProfessionalName { get; set; }
        public string? ProfessionalEmail { get; set; }
        public string? CustomerRef { get; set; }
        public int? Attendees { get; set; }
        public string? PrepContactName { get; set; }
        public string? PrepContactEmail { get; set; }
    }
}
