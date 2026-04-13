using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace IIAPI.Models
{
    [Table("Customer")]
    public class Customer
    {
        [Key]
        public int Id { get; set; }
        public string? Name { get; set; }
        public int? SectorId { get; set; }
        public string? Contact { get; set; }
        public string? ContactNumber { get; set; }
        public string? ContactEmail { get; set; }
        public string? InvoiceName { get; set; }
        public string? InvoiceEmail { get; set; }
        public int? BSLRateType { get; set; }
        public int? StatusId { get; set; }
        public decimal? AgreedRate { get; set; }
        public decimal? VRIATWCharge { get; set; }
        public string? VRIATWMins { get; set; }
        public string? VRIATWLink { get; set; }
        public bool? VRIATW { get; set; }
    }
}
