using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using IIAPI.Models;
using System.Reflection.Emit;
using System.Reflection.Metadata; // namespace for ApplicationUser

namespace IIAPI.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        // Add your other DbSets here if needed
        public DbSet<Booking> Bookings { get; set; }
        public DbSet<BookingViewDetail> BookingViewDetails {get; set;}
        
        public DbSet<DurationModel> Duration {get; set;}
        public DbSet<BookingTypeModel> BookingType { get; set; }
        public DbSet<Customer> Customers { get; set; }
        public DbSet<CustSector> CustSectors { get; set; }
        public DbSet<CustomerStatus> CustomerStatuses { get; set; }
        public DbSet<BSLRateTypeModel> BSLRateTypes { get; set; }
    }
}
