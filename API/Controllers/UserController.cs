using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using IIAPI.Models;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;

[Route("api/[controller]")]
[ApiController]
public class UsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly EmailService _emailService;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public UsersController(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        EmailService emailService,
        IConfiguration config,
        IWebHostEnvironment env)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _emailService = emailService;
        _config = config;
        _env = env;
    }

    private string? GetLogoDataUri()
    {
        var path = Path.Combine(_env.WebRootPath ?? "", "logo.png");
        if (!System.IO.File.Exists(path)) return null;
        var bytes = System.IO.File.ReadAllBytes(path);
        return $"data:image/png;base64,{Convert.ToBase64String(bytes)}";
    }

    private static string GenerateToken() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    // Generates a random password that satisfies ASP.NET Identity's default rules
    private static string GenerateTempPassword()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes) + "A1!"; // ensures upper, digit, special
    }

    private string BuildActivationEmail(string firstName, string activationLink)
    {
        var logoSrc = GetLogoDataUri() ?? "";
        return $@"
<!DOCTYPE html>
<html lang=""en"">
<head><meta charset=""UTF-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1""><title>Activate your account</title></head>
<body style=""margin:0;padding:0;background-color:#f8fafc;"">
  <!--[if mso]><table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0""><tr><td align=""center"" style=""padding:40px 0;""><![endif]-->
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""background-color:#f8fafc;"">
    <tr><td align=""center"" style=""padding:40px 16px;"">

      <table role=""presentation"" width=""560"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""width:560px;max-width:100%;background-color:#ffffff;border:1px solid #e2e8f0;"">

        <!-- Header -->
        <tr>
          <td bgcolor=""#003366"" style=""background-color:#003366;padding:20px 40px;"">
            <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"">
              <tr>
                <td style=""padding-right:14px;vertical-align:middle;"">
                  <img src=""{logoSrc}"" alt="""" width=""36"" height=""36"" style=""display:block;border:0;border-radius:4px;"" />
                </td>
                <td style=""vertical-align:middle;"">
                  <p style=""margin:0;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#ffffff;"">Involve Interpreter</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td bgcolor=""#ffffff"" style=""background-color:#ffffff;padding:36px 40px;"">
            <p style=""margin:0 0 12px 0;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#0f172a;"">Welcome, {firstName}!</p>
            <p style=""margin:0 0 24px 0;font-family:Arial,sans-serif;font-size:14px;color:#475569;line-height:1.6;"">
              Your Involve Interpreter account has been created. Please activate it by clicking the button below.
              This link will expire in <strong>7 days</strong>.
            </p>

            <!-- Button -->
            <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""margin:28px auto;"">
              <tr>
                <td bgcolor=""#003366"" style=""background-color:#003366;padding:14px 36px;"">
                  <a href=""{activationLink}"" style=""font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;"">Activate my account</a>
                </td>
              </tr>
            </table>

            <p style=""margin:20px 0 0 0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;"">
              Or paste this link into your browser:<br/>
              <a href=""{activationLink}"" style=""color:#0057b8;word-break:break-all;font-family:Arial,sans-serif;font-size:12px;"">{activationLink}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor=""#f8fafc"" style=""background-color:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;"">
            <p style=""margin:0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;"">If you did not expect this email, you can ignore it safely.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>";
    }

    [HttpGet]
    public IActionResult GetAllUsers()
    {
        var users = _userManager.Users
            .Select(u => new
            {
                u.Id,
                u.UserName,
                u.Email,
                u.FirstName,
                u.LastName,
                u.CompanyId
            })
            .ToList();

        return Ok(users);
    }
    [HttpGet("with-roles")]
    public async Task<IActionResult> GetUsersWithRoles()
    {
        var users = _userManager.Users.ToList(); // materialize first
        var result = new List<UserDto>();

        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            result.Add(new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                UserName = user.UserName,
                FirstName = user.FirstName,
                LastName = user.LastName,
                CompanyId = user.CompanyId,
                Roles = roles.ToList(),
                EmailConfirmed = user.EmailConfirmed,
            });
        }

        return Ok(result);
    }
    // -------------------
    // Update user roles
    // -------------------
    [HttpPost("{userId}/roles")]
    public async Task<IActionResult> UpdateRoles(string userId, [FromBody] List<string> roles)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound("User not found");

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (currentUserId == userId && !roles.Contains("Admin"))
            return BadRequest("You cannot remove your own Admin role.");

        foreach (var role in roles)
        {
            if (!await _roleManager.RoleExistsAsync(role))
                return BadRequest($"Role '{role}' does not exist");
        }

        var currentRoles = await _userManager.GetRolesAsync(user);

        var rolesToRemove = currentRoles.Except(roles);
        if (rolesToRemove.Any())
            await _userManager.RemoveFromRolesAsync(user, rolesToRemove);

        var rolesToAdd = roles.Except(currentRoles);
        if (rolesToAdd.Any())
            await _userManager.AddToRolesAsync(user, rolesToAdd);

        return Ok(new { message = "Roles updated successfully" });
    }

    // -------------------
    // Customer-role users (for admin booking on behalf)
    // -------------------
    [HttpGet("customer-users")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetCustomerUsers()
    {
        var users = await _userManager.GetUsersInRoleAsync("Customer");
        var result = users
            .OrderBy(u => u.FirstName)
            .ThenBy(u => u.LastName)
            .Select(u => new
            {
                u.Id,
                u.FirstName,
                u.LastName,
                u.Email,
                u.CompanyId,
                u.PhoneNumber,
            });
        return Ok(result);
    }

    // -------------------
    // Create user (admin)
    // -------------------
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserModel model)
    {
        var token = GenerateToken();

        var user = new ApplicationUser
        {
            UserName = model.Email,
            Email = model.Email,
            FirstName = model.FirstName,
            LastName = model.LastName,
            CompanyId = model.CompanyId,
            PhoneNumber = model.Phone,
            EmailConfirmed = false,
            ActivationToken = token,
            ActivationTokenExpiry = DateTime.UtcNow.AddDays(7),
        };

        var result = await _userManager.CreateAsync(user, GenerateTempPassword());
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        if (model.Roles != null && model.Roles.Any())
        {
            foreach (var role in model.Roles)
            {
                if (await _roleManager.RoleExistsAsync(role))
                    await _userManager.AddToRoleAsync(user, role);
            }
        }

        var appUrl = _config["AppUrl"] ?? "http://localhost:5173";
        var activationLink = $"{appUrl}/activate?token={token}";
        var html = BuildActivationEmail(model.FirstName, activationLink);

        _ = Task.Run(async () =>
        {
            try { await _emailService.SendAsync(model.Email, "Activate your Involve Interpreter account", html); }
            catch (Exception ex) { Console.WriteLine($"[Email] Activation send failed: {ex.Message}"); }
        });

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            UserName = user.UserName,
            FirstName = user.FirstName,
            LastName = user.LastName,
            CompanyId = user.CompanyId,
            Roles = roles.ToList(),
            EmailConfirmed = user.EmailConfirmed,
        });
    }

    // -------------------
    // Resend activation email
    // -------------------
    [HttpPost("resend-activation/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResendActivation(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound("User not found");

        if (user.EmailConfirmed)
            return BadRequest("User is already activated.");

        var token = GenerateToken();
        user.ActivationToken = token;
        user.ActivationTokenExpiry = DateTime.UtcNow.AddDays(7);
        await _userManager.UpdateAsync(user);

        var appUrl = _config["AppUrl"] ?? "http://localhost:5173";
        var activationLink = $"{appUrl}/activate?token={token}";
        var html = BuildActivationEmail(user.FirstName ?? user.Email!, activationLink);

        _ = Task.Run(async () =>
        {
            try { await _emailService.SendAsync(user.Email!, "Activate your Involve Interpreter account", html); }
            catch (Exception ex) { Console.WriteLine($"[Email] Resend activation failed: {ex.Message}"); }
        });

        return Ok(new { message = "Activation email resent." });
    }

    // -------------------
    // Update user details
    // -------------------
    [HttpPut("{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUser(string userId, [FromBody] UpdateUserModel model)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound("User not found");

        user.FirstName = model.FirstName;
        user.LastName = model.LastName;
        user.PhoneNumber = model.Phone;
        user.CompanyId = model.CompanyId;

        if (!string.IsNullOrWhiteSpace(model.Email) && model.Email != user.Email)
        {
            user.Email = model.Email;
            user.UserName = model.Email;
        }

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        if (model.Roles != null)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (currentUserId == userId && !model.Roles.Contains("Admin"))
                return BadRequest("You cannot remove your own Admin role.");

            var currentRoles = await _userManager.GetRolesAsync(user);
            var toRemove = currentRoles.Except(model.Roles);
            if (toRemove.Any()) await _userManager.RemoveFromRolesAsync(user, toRemove);
            var toAdd = model.Roles.Except(currentRoles);
            if (toAdd.Any()) await _userManager.AddToRolesAsync(user, toAdd);
        }

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            UserName = user.UserName,
            FirstName = user.FirstName,
            LastName = user.LastName,
            CompanyId = user.CompanyId,
            Roles = roles.ToList()
        });
    }

    // -------------------
    // Delete user
    // -------------------
    [HttpDelete("{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUser(string userId)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId == userId)
            return BadRequest("You cannot delete your own account.");

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null) return NotFound("User not found");

        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
            return BadRequest(result.Errors);

        return Ok(new { message = "User deleted" });
    }
}