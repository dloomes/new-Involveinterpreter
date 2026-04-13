using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IIAPI.Models.DTOs
{
    public class CreateBookingDto
    {
        
        public int? CustId { get; set; }
        public int? DeptId { get; set; }
        public string? UserId { get; set; }
        public string? ContactNumber { get; set; }
        public string? ContactEmail { get; set; }
        public string? AddEmail { get; set; }
        public DateTime BookingDate { get; set; }
        public DateTime BookingTime { get; set; }
        public int? DurationId { get; set; }
        public int? LangRequired { get; set; }
        public string? VideoUrl { get; set; }
        public string? AddInfo { get; set; }
        public int? BookingStatus { get; set; }
        public DateTime? DateAdded { get; set; }
        public string? OnBehalfUser { get; set; }
        public string? Interpreter1 { get; set; }
        public string? Interpreter2 { get; set; }
        public DateTime? CancelDate { get; set; }
        public string? CancelledBy { get; set; }
        public string? CancelComments { get; set; }
        public int? ActualMins { get; set; }
        public string? DeclineComments { get; set; }
        public DateTime? DeclineDate { get; set; }
        public string? DeclinedBy { get; set; }
        public string? AdminID { get; set; }
        public bool? AddedByAdmin { get; set; }
        public int? BookingType { get; set; }
        public string? OutlookID { get; set; }
        public int? Attendees { get; set; }
        public int? deafattendees { get; set; }
        public int? prep { get; set; }
        public string? customerURL { get; set; }
        public string? DeafName { get; set; }
        public bool? material { get; set; }
        
    }
}