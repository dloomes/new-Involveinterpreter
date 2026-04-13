using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IIAPI.Models
{
    [Table("BSLRateType")]
    public class BSLRateTypeModel
    {
        [Key]
        public int Id { get; set; }
        [Column("BSLRateType")]
        public string? RateType { get; set; }
    }
}
