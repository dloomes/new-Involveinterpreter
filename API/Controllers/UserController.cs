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

    public UsersController(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        EmailService emailService,
        IConfiguration config)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _emailService = emailService;
        _config = config;
    }

    private static string GenerateToken() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    // Generates a random password that satisfies ASP.NET Identity's default rules
    private static string GenerateTempPassword()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes) + "A1!"; // ensures upper, digit, special
    }

    private string BuildActivationEmail(string firstName, string activationLink) => $@"
<!DOCTYPE html>
<html>
<body style=""margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;"">
  <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#f8fafc;padding:40px 0;"">
    <tr><td align=""center"">
      <table width=""560"" cellpadding=""0"" cellspacing=""0"" style=""background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;"">
        <tr><td style=""background:linear-gradient(90deg,#061926 0%,#0c6ea6 100%);padding:28px 40px;"">
          <p style=""margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;"">Involve Interpreter</p>
        </td></tr>
        <tr><td style=""padding:36px 40px;"">
          <p style=""margin:0 0 12px;font-size:18px;font-weight:600;color:#0f172a;"">Welcome, {firstName}!</p>
          <p style=""margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;"">
            Your Involve Interpreter account has been created. Please activate it by clicking the button below.
            This link will expire in <strong>7 days</strong>.
          </p>
          <div style=""text-align:center;margin:28px 0;"">
            <a href=""{activationLink}"" style=""display:inline-block;background:linear-gradient(90deg,#003366 0%,#0057b8 100%);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;"">
              Activate my account
            </a>
          </div>
          <p style=""margin:20px 0 0;font-size:12px;color:#94a3b8;"">
            Or paste this link into your browser:<br/>
            <a href=""{activationLink}"" style=""color:#0057b8;word-break:break-all;"">{activationLink}</a>
          </p>
        </td></tr>
        <tr><td style=""background:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;"">
          <p style=""margin:0;font-size:12px;color:#94a3b8;"">If you did not expect this email, you can ignore it safely.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>";

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