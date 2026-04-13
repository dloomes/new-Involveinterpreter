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
}
}
