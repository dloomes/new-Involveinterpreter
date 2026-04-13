using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IIAPI.Models
{
    [Table("CustSector")]
    public class CustSector
    {
        [Key]
        public int Id { get; set; }
        public string? Sector { get; set; }
    }
}
