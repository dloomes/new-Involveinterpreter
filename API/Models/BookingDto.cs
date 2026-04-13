// Models/BookingDto.cs
using System.Text;

public class BookingDto
{
    public int id { get; set; }
    public DateTime? BookingDate { get; set; }
    public DateTime? BookingTime { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactNumber { get; set; }
    public string AddInfo { get; set; }
    public string Duration { get; set; }
    public string? VideoUrl { get; set; }
    public string Customer { get; set; }
    public string? RequestedBy { get; set; }
    public string Status { get; set; }

}