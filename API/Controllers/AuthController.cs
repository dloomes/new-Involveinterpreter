using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Text;
using IIAPI.Models;
using Microsoft.EntityFrameworkCore;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _config;
    private readonly EmailService _emailService;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration config,
        EmailService emailService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
        _emailService = emailService;
    }

    // ---------------------
    // Registration
    // ---------------------
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterModel model)
    {
        var user = new ApplicationUser { UserName = model.Email, Email = model.Email };
        var result = await _userManager.CreateAsync(user, model.Password);

        if (!result.Succeeded)
            return BadRequest(result.Errors);

        return Ok(new { message = "Registration successful" });
    }
    // ---------------------
// Change Password
// ---------------------
[Authorize]
[HttpPost("change-password")]
public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordModel model)
{
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

    if (userId == null)
        return Unauthorized();

    var user = await _userManager.FindByIdAsync(userId);

    if (user == null)
        return Unauthorized();

    var result = await _userManager.ChangePasswordAsync(
        user,
        model.CurrentPassword,
        model.NewPassword
    );

    if (!result.Succeeded)
        return BadRequest(result.Errors);

    return Ok(new { message = "Password changed successfully" });
}

    // ---------------------
    // Login
    // ---------------------
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginModel model)
{
    var user = await _userManager.FindByEmailAsync(model.Email);
    if (user == null) return Unauthorized();

    var result = await _signInManager.CheckPasswordSignInAsync(user, model.Password, false);
    if (!result.Succeeded) return Unauthorized();

    // ✅ GET USER ROLES
    var roles = await _userManager.GetRolesAsync(user);

    // Create JWT token
    var tokenHandler = new JwtSecurityTokenHandler();
    var key = Encoding.UTF8.GetBytes(_config["Jwt:Key"]);

    // ✅ BUILD CLAIMS LIST
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id),
        new Claim(ClaimTypes.Email, user.Email)
    };

    // ✅ ADD ROLES TO JWT
    claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(claims),
        Expires = DateTime.UtcNow.AddDays(7),
        Issuer = _config["Jwt:Issuer"],
        Audience = _config["Jwt:Audience"],
        SigningCredentials = new SigningCredentials(
            new SymmetricSecurityKey(key),
            SecurityAlgorithms.HmacSha256Signature)
    };

    var token = tokenHandler.CreateToken(tokenDescriptor);
    var tokenString = tokenHandler.WriteToken(token);

    Response.Cookies.Append("access_token", tokenString, new CookieOptions
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.None,
        Path = "/",
        Expires = DateTime.UtcNow.AddDays(7)
    });

    return Ok(new { message = "Login successful" });
}

    // ---------------------
    // Logout
    // ---------------------
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("access_token");
        return Ok(new { message = "Successfully Logged out" });
    }

    // ---------------------
    // Forgot Password
    // ---------------------
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordModel model)
    {
        try
        {
            Console.WriteLine($"[ForgotPassword] Request received for: {model?.Email}");

            var user = await _userManager.FindByEmailAsync(model!.Email);
            if (user == null)
            {
                Console.WriteLine("[ForgotPassword] User not found — returning Ok silently");
                return Ok(new { message = "If that email exists, a reset link has been sent" });
            }

            Console.WriteLine($"[ForgotPassword] User found: {user.Id}");

            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var encodedToken = Uri.EscapeDataString(token);
            var encodedEmail = Uri.EscapeDataString(user.Email!);
            var appUrl = _config["AppUrl"] ?? "http://localhost:5173";
            var resetUrl = $"{appUrl}/reset-password?email={encodedEmail}&token={encodedToken}";

            Console.WriteLine($"[ForgotPassword] Reset URL: {resetUrl}");

            var firstName = user.FirstName ?? user.Email!;
            var emailTo   = user.Email!;
            var logoUrl   = $"{appUrl}/logo.png";
            var htmlBody  = $@"<!DOCTYPE html>
<html lang=""en"">
<head><meta charset=""UTF-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1""><title>Reset your password</title></head>
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
                  <img src=""{logoUrl}"" alt="""" width=""36"" height=""36"" style=""display:block;border:0;border-radius:4px;"" />
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
            <p style=""margin:0 0 12px 0;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#0f172a;"">Hi {firstName},</p>
            <p style=""margin:0 0 24px 0;font-family:Arial,sans-serif;font-size:14px;color:#475569;line-height:1.6;"">We received a request to reset your password. Click the button below — this link expires in <strong>24 hours</strong>.</p>

            <!-- Button -->
            <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""margin:28px auto;"">
              <tr>
                <td bgcolor=""#003366"" style=""background-color:#003366;padding:14px 36px;"">
                  <a href=""{resetUrl}"" style=""font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;"">Reset password</a>
                </td>
              </tr>
            </table>

            <p style=""margin:20px 0 0 0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;"">
              Or paste this link into your browser:<br/>
              <a href=""{resetUrl}"" style=""color:#0057b8;word-break:break-all;font-family:Arial,sans-serif;font-size:12px;"">{resetUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor=""#f8fafc"" style=""background-color:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;"">
            <p style=""margin:0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;"">If you didn't request this, you can safely ignore this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>";

            // Send in background — respond immediately so the browser doesn't time out
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendAsync(emailTo, "Involve Interpreter — Reset your password", htmlBody);
                    Console.WriteLine("[ForgotPassword] Email sent successfully");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[ForgotPassword] Background email error: {ex.Message}");
                }
            });

            return Ok(new { message = "Password reset link sent" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ForgotPassword] Unhandled error: {ex.GetType().Name}: {ex.Message}");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ---------------------
    // Reset Password
    // ---------------------
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordModel model)
    {
        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null) return BadRequest();

        var result = await _userManager.ResetPasswordAsync(user, model.Token, model.NewPassword);
        if (!result.Succeeded) return BadRequest(result.Errors);

        return Ok(new { message = "Password has been reset" });
    }
    // ---------------------
    // User info
    // ---------------------
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (userId == null)
            return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
            return Unauthorized();

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
[Authorize]
[HttpPut("me")]
public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileModel model)
{
    var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    if (userId == null) return Unauthorized();

    var user = await _userManager.FindByIdAsync(userId);
    if (user == null) return Unauthorized();

    // Update allowed fields
    user.FirstName = model.FirstName;
    user.LastName = model.LastName;
    user.PhoneNumber = model.Phone;

    var result = await _userManager.UpdateAsync(user);

    if (!result.Succeeded)
        return BadRequest(result.Errors);

    return Ok(new UserDto
    {
        Id = user.Id,
        Email = user.Email,
        UserName = user.UserName,
        FirstName = user.FirstName,
        LastName = user.LastName,
        CompanyId = user.CompanyId,
        Roles = (await _userManager.GetRolesAsync(user)).ToList()
    });
}

    // ---------------------
    // Activate account
    // ---------------------
    [HttpPost("activate")]
    public async Task<IActionResult> Activate([FromBody] ActivateModel model)
    {
        if (string.IsNullOrWhiteSpace(model.Token))
            return BadRequest(new { message = "No activation token provided." });

        if (string.IsNullOrWhiteSpace(model.Password))
            return BadRequest(new { message = "A password is required." });

        var user = await _userManager.Users
            .FirstOrDefaultAsync(u => u.ActivationToken == model.Token);

        if (user == null)
            return BadRequest(new { message = "Invalid activation link." });

        if (user.ActivationTokenExpiry == null || user.ActivationTokenExpiry < DateTime.UtcNow)
            return BadRequest(new { message = "This activation link has expired. Please ask an admin to resend the welcome email." });

        // Replace the temporary password with the user's chosen one
        await _userManager.RemovePasswordAsync(user);
        var pwResult = await _userManager.AddPasswordAsync(user, model.Password);
        if (!pwResult.Succeeded)
            return BadRequest(new { message = string.Join(" ", pwResult.Errors.Select(e => e.Description)) });

        user.EmailConfirmed = true;
        user.ActivationToken = null;
        user.ActivationTokenExpiry = null;

        await _userManager.UpdateAsync(user);

        return Ok(new { message = "Account activated successfully. You can now log in." });
    }
}
