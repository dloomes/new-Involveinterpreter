using Microsoft.AspNetCore.Identity;

namespace IIAPI.Models
{
public class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public int CompanyId { get; set; }
    public string? ActivationToken { get; set; }
    public DateTime? ActivationTokenExpiry { get; set; }

    // Personal preference, not a system-wide switch: whether THIS admin/super
    // admin receives the admin-copy booking notification emails (created,
    // updated, cancelled, assigned, declined). Never affects customer or
    // interpreter emails, and never affects any other admin's preference.
    public bool ReceiveBookingNotifications { get; set; } = true;
}
}
