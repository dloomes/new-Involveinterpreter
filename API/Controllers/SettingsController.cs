using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using IIAPI.Models;

// Roles string deliberately has no space after the comma: ASP.NET Core splits
// on ',' without trimming each token, so "Admin, Super Admin" would silently
// fail to match a user whose only role is "Super Admin".
[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin,Super Admin")]
public class SettingsController : ControllerBase
{
    private readonly SystemSettingsService _settings;
    private readonly UserManager<ApplicationUser> _userManager;

    public SettingsController(SystemSettingsService settings, UserManager<ApplicationUser> userManager)
    {
        _settings = settings;
        _userManager = userManager;
    }

    public class SetNotificationsDto
    {
        public bool Enabled { get; set; }
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> GetNotifications()
    {
        var enabled = await _settings.AreEmailNotificationsEnabledAsync();
        return Ok(new { enabled });
    }

    [HttpPut("notifications")]
    public async Task<IActionResult> SetNotifications([FromBody] SetNotificationsDto dto)
    {
        var user = await _userManager.GetUserAsync(User);
        await _settings.SetEmailNotificationsEnabledAsync(dto.Enabled, user?.Id);
        return Ok(new { enabled = dto.Enabled });
    }
}
