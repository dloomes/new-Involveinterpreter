using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IIAPI.Models
{
    // One row per action taken on a booking — created, updated, assigned,
    // cancelled, declined, time logged. Details holds a flattened, readable
    // rendering of whatever changed (not structured JSON — nothing needs to
    // query individual fields later, only display them).
    [Table("BookingAuditLog")]
    public class BookingAuditLogEntry
    {
        [Key]
        public int Id { get; set; }
        public int BookingId { get; set; }
        public string EventType { get; set; } = "";
        public string Summary { get; set; } = "";
        public string? Details { get; set; }
        public string? ActorUserId { get; set; }
        public string? ActorName { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
