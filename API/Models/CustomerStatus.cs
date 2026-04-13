using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IIAPI.Models
{
    [Table("CustomerStatus")]
    public class CustomerStatus
    {
        [Key]
        public int Id { get; set; }
        public string? Status { get; set; }
    }
}
