using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text;

namespace IIAPI.Models
{
    [Table("vw_AllBookings")]
    public class BookingViewDetail
    {
        [Key]
        public int BookingId { get; set; }
        public string? FullName { get; set; }

        public string? Customer { get; set; }
        public DateTime? BookingDate { get; set; }
        public DateTime? BookingTime { get; set; }
        public string? Duration { get; set; }
        public string? Language { get; set; }

        public string? Status { get; set; }
        [Column("Int 1")]
        public string? Int1 { get; set; }
        [Column("Int 2")]
        public String? Int2 { get; set; }
        
    }
}