using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using IIAPI.Data;
using IIAPI.Models;
using IIAPI.Models.DTOs;
using System.Security.Cryptography.X509Certificates;
using System.Diagnostics.Contracts;
using System.Runtime.CompilerServices;
using Microsoft.VisualBasic;
using System.Linq.Expressions;
using System.Xml;
using System.Reflection.Metadata;
using System.ComponentModel;
using System.ComponentModel.Design.Serialization;
using System.Reflection.PortableExecutable;
using System.Security.AccessControl;
using System.Runtime.Serialization;
using System.Reflection.Metadata.Ecma335;
using System.Globalization;
using System.Security.Claims;
using System.Diagnostics.Tracing;

namespace IIAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class BookingsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly BookingService _bookingService;
        private readonly EmailService _emailService;
        private readonly SqodService _sqodService;

        public BookingsController(ApplicationDbContext context, UserManager<ApplicationUser> userManager, BookingService bookingService, EmailService emailService, SqodService sqodService)
        {
            _context = context;
            _userManager = userManager;
            _bookingService = bookingService;
            _emailService = emailService;
            _sqodService = sqodService;
        }

        // GET: api/bookings
        [HttpGet]
        public async Task<IActionResult> GetAllBookings()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("Unauthorized: User not found");
                return Unauthorized();
            }

            var roles = await _userManager.GetRolesAsync(user);
            Console.WriteLine($"UserId: {user.Id}, Roles: {string.Join(",", roles)}");

            IQueryable<Booking> query = _context.Bookings.AsNoTracking();

            // Role-based filtering
            if (roles.Contains("Client"))
            {
                query = query.Where(b => b.UserId == user.Id);
            }
            else if (roles.Contains("Interpreter"))
            {
                query = query.Where(b => b.Interpreter1 == user.Id || b.Interpreter2 == user.Id);
            }
            // Admin sees all bookings

            var bookings = await query
                .OrderByDescending(b => b.BookingDate)
                .Select(b => new
                {
                    b.BookingId,
                    b.UserId,
                    b.ContactName,
                    b.ContactEmail,
                    b.BookingDate,
                    b.BookingTime,
                    b.BookingStatus,
                    b.BookingType,
                    b.Interpreter1,
                    b.Interpreter2,
                    Notes = b.AddInfo
                })
                .ToListAsync();

            Console.WriteLine($"Returned {bookings.Count} bookings");
            return Ok(bookings);
        }

        [HttpGet("details")]
        public async Task<IActionResult> GetBookingDetails()
        {
            var data = await _context.BookingViewDetails
            .OrderByDescending(b => b.BookingDate)
            .ToListAsync();

            return Ok(data);
        }

        // GET: api/bookings/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetBooking(int id)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                Console.WriteLine("Unauthorized: User not found");
                return Unauthorized();
            }

            var roles = await _userManager.GetRolesAsync(user);
            Console.WriteLine($"UserId: {user.Id}, Roles: {string.Join(",", roles)}");
            Console.WriteLine($"Requested BookingId: {id}");

            var booking = await _context.Bookings
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.BookingId == id);

            if (booking == null)
            {
                Console.WriteLine("Booking not found");
                return NotFound();
            }

            // Role-based access
            if (roles.Contains("Client") && (booking.UserId == null || booking.UserId != user.Id))
            {
                Console.WriteLine("Access denied: Client trying to access other client's booking");
                return Forbid();
            }

            if (roles.Contains("Interpreter") &&
                (booking.Interpreter1 != user.Id && booking.Interpreter2 != user.Id))
            {
                Console.WriteLine("Access denied: Interpreter not assigned to this booking");
                return Forbid();
            }

            // Admins see everything

            var result = new
            {
                booking.BookingId,
                booking.UserId,
                booking.ContactName,
                booking.ContactEmail,
                booking.ContactNumber,
                booking.BookingDate,
                booking.BookingTime,
                booking.DurationId,
                booking.LangRequired,
                booking.BookingStatus,
                booking.BookingType,
                booking.Interpreter1,
                booking.Interpreter2,
                Notes = booking.AddInfo,
                booking.AddedByAdmin,
                booking.OutlookID,
                booking.VideoUrl,
                booking.customerURL
            };

            Console.WriteLine("Booking returned successfully");
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto dto)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
                return Unauthorized();
            Console.WriteLine("Got to here");



            //Console.WriteLine(bookingstart);
            try
            {
                var roles = await _userManager.GetRolesAsync(user);
                bool isAdmin = roles.Contains("Admin");

                // Admin can book on behalf of another user
                string targetUserId = (!string.IsNullOrWhiteSpace(dto.UserId) && isAdmin)
                    ? dto.UserId : user.Id;
                int? targetCustId = (dto.CustId.HasValue && isAdmin)
                    ? dto.CustId : user.CompanyId;

                var booking = new Booking
                {
                    CustId = targetCustId,
                    ContactEmail = dto.ContactEmail,
                    DurationId = dto.DurationId,
                    LangRequired = 1,
                    AddInfo = dto.AddInfo,
                    BookingStatus = 1,
                    BookingType = dto.BookingType,
                    UserId = targetUserId,
                    AddedByAdmin = isAdmin,
                    DateAdded = DateTime.UtcNow,
                    ContactNumber = dto.ContactNumber,
                    BookingDate = dto.BookingDate,
                    BookingTime = dto.BookingTime,
                    VideoUrl = dto.VideoUrl
                };
                _context.Bookings.Add(booking);
                await _context.SaveChangesAsync();
                Console.WriteLine(booking);

                var customerUser = await _userManager.FindByIdAsync(targetUserId);

                // If no video URL was provided, generate one via SQOD
                if (string.IsNullOrWhiteSpace(booking.VideoUrl) && customerUser != null)
                {
                    int? durationMins = null;
                    if (booking.DurationId.HasValue)
                    {
                        var dur = await _context.Duration.FindAsync(booking.DurationId.Value);
                        if (dur != null && int.TryParse(dur.DurationValue, out var mins))
                            durationMins = mins;
                    }

                    var sqodResult = await _sqodService.CreateAppointmentAsync(booking, customerUser, durationMins);
                    if (sqodResult != null)
                    {
                        booking.VideoUrl          = sqodResult.CustomerUrl;   // customer pre-call link
                        booking.customerURL        = sqodResult.RoomUrl;       // agent/interpreter room link
                        booking.SqodAppointmentId  = sqodResult.AppointmentId; // UUID for future cancel
                        await _context.SaveChangesAsync();
                    }
                }

                // Send booking-created notifications
                var admins = (await _userManager.GetUsersInRoleAsync("Admin")).ToList();
                if (customerUser?.Email != null)
                {
                    var custName = customerUser.FirstName ?? customerUser.Email;
                    FireBookingNotification(booking,
                        customerEmail: customerUser.Email,
                        customerName: custName,
                        admins: admins,
                        customerSubject: $"Booking #{booking.BookingId} — Received",
                        customerIntro: "Thank you for your booking. We have received your request and will be in touch shortly to confirm your interpreter.",
                        adminSubject: $"New booking #{booking.BookingId} — {custName}",
                        adminIntro: $"A new booking has been submitted by <strong>{customerUser.FirstName} {customerUser.LastName}</strong>."
                    );
                }

                return Ok(booking);
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
                return StatusCode(500, ex.Message);
            }
        }




        [HttpGet("my-bookings")]
        public async Task<IActionResult> MyBookings()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var bookings = await _bookingService.GetBookingsByUserAsync(userId);
            return Ok(bookings);
        }
        [HttpGet("pending-bookings")]
        public async Task<IActionResult> PendingBookings()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var bookings = await _bookingService.GetPendingBookingsByUserAsync(userId);
            return Ok(bookings);
        }
        [HttpGet("future-bookings")]
        public async Task<IActionResult> FutureBookings()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var bookings = await _bookingService.GetFutureBookingsByUserAsync(userId);
            return Ok(bookings);
        }
        [HttpGet("cancelled-bookings")]
        public async Task<IActionResult> CancelledBookings()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var bookings = await _bookingService.GetCancelledBookingsByUserAsync(userId);
            return Ok(bookings);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBooking(int id, [FromBody] UpdateBookingDto dto)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.BookingId == id);
            if (booking == null) return NotFound();

            var roles = await _userManager.GetRolesAsync(user);
            if (!roles.Contains("Admin") && booking.UserId != user.Id)
                return Forbid();

            booking.BookingDate = dto.BookingDate;
            booking.BookingTime = dto.BookingTime;
            booking.DurationId = dto.DurationId;
            booking.BookingType = dto.BookingType;
            booking.ContactEmail = dto.ContactEmail;
            booking.ContactNumber = dto.ContactNumber;
            booking.AddInfo = dto.AddInfo;
            booking.VideoUrl = dto.VideoUrl;

            await _context.SaveChangesAsync();

            // Sync updated details to SQOD if this booking has an associated appointment
            if (!string.IsNullOrWhiteSpace(booking.SqodAppointmentId))
            {
                var customerUser2 = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
                if (customerUser2 != null)
                {
                    int? durationMins = null;
                    if (booking.DurationId.HasValue)
                    {
                        var dur = await _context.Duration.FindAsync(booking.DurationId.Value);
                        if (dur != null && int.TryParse(dur.DurationValue, out var mins))
                            durationMins = mins;
                    }
                    _ = _sqodService.UpdateAppointmentAsync(booking.SqodAppointmentId, booking, customerUser2, durationMins);
                }
            }

            // Send booking-updated notifications
            var customerUser = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
            var admins = (await _userManager.GetUsersInRoleAsync("Admin")).ToList();
            if (customerUser?.Email != null)
            {
                var custName = customerUser.FirstName ?? customerUser.Email;
                FireBookingNotification(booking,
                    customerEmail: customerUser.Email,
                    customerName: custName,
                    admins: admins,
                    customerSubject: $"Booking #{booking.BookingId} — Updated",
                    customerIntro: "Your booking details have been updated. Please see the summary below.",
                    adminSubject: $"Booking #{booking.BookingId} updated — {custName}",
                    adminIntro: $"Booking #{booking.BookingId} has been updated for <strong>{customerUser.FirstName} {customerUser.LastName}</strong>."
                );
            }

            return Ok(booking);
        }

        [HttpPatch("{id}/cancel")]
        public async Task<IActionResult> CancelBooking(int id)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.BookingId == id);
            if (booking == null) return NotFound();

            var roles = await _userManager.GetRolesAsync(user);
            if (!roles.Contains("Admin") && booking.UserId != user.Id)
                return Forbid();

            // Resolve the cancelled status ID from the BookingStatus table
            int cancelStatusId = 3;
            var connectionString = _context.Database.GetConnectionString();
            using (var conn = new Microsoft.Data.SqlClient.SqlConnection(connectionString))
            {
                await conn.OpenAsync();
                using var cmd = new Microsoft.Data.SqlClient.SqlCommand(
                    "SELECT TOP 1 Id FROM BookingStatus WHERE Status LIKE '%Cancel%'", conn);
                var result = await cmd.ExecuteScalarAsync();
                if (result != null && result != DBNull.Value)
                    cancelStatusId = Convert.ToInt32(result);
            }

            booking.BookingStatus = cancelStatusId;
            booking.CancelDate = DateTime.UtcNow;
            booking.CancelledBy = user.Id;

            await _context.SaveChangesAsync();

            // Notify SQOD if this booking has an associated appointment
            if (!string.IsNullOrWhiteSpace(booking.SqodAppointmentId))
            {
                _ = _sqodService.CancelAppointmentAsync(booking.SqodAppointmentId, "Booking cancelled via BSL portal");
            }

            return Ok();
        }

        [HttpGet("calendar-view")]
        public async Task<IActionResult> CalendarView()
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var events = await _bookingService.GetCalendarViewAsync(userId);
                return Ok(events);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"CalendarView error: {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        [HttpGet("calendar-admin")]
        public async Task<IActionResult> CalendarAdmin()
        {
            try
            {
                var events = await _bookingService.GetAdminCalendarViewAsync();
                return Ok(events);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"CalendarView error: {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("{id}/available-interpreters")]
        public async Task<IActionResult> GetAvailableInterpreters(int id)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();
            var userRoles = await _userManager.GetRolesAsync(currentUser);
            if (!userRoles.Contains("Admin")) return Forbid();

            var booking = await _context.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.BookingId == id);
            if (booking == null) return NotFound();

            // Find interpreter IDs already committed on the same date (excluding this booking and cancelled)
            var busyIds = new HashSet<string>();
            if (booking.BookingDate.HasValue)
            {
                var connectionString = _context.Database.GetConnectionString();
                using var conn = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
                await conn.OpenAsync();

                const string sql = @"
                    SELECT b.Interpreter1, b.Interpreter2
                    FROM Booking b
                    WHERE CAST(b.BookingDate AS DATE) = CAST(@date AS DATE)
                      AND b.BookingId != @id
                      AND (b.Interpreter1 IS NOT NULL OR b.Interpreter2 IS NOT NULL)
                      AND b.BookingStatus NOT IN (
                          SELECT Id FROM BookingStatus WHERE Status LIKE '%Cancel%'
                      )";

                using var cmd = new Microsoft.Data.SqlClient.SqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("@date", booking.BookingDate.Value.Date);
                cmd.Parameters.AddWithValue("@id", id);

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    if (!reader.IsDBNull(0)) busyIds.Add(reader.GetString(0));
                    if (!reader.IsDBNull(1)) busyIds.Add(reader.GetString(1));
                }
            }

            var interpreters = await _userManager.GetUsersInRoleAsync("Interpreter");

            var result = interpreters
                .Select(i => new
                {
                    id        = i.Id,
                    firstName = i.FirstName,
                    lastName  = i.LastName,
                    available = !busyIds.Contains(i.Id),
                })
                .OrderBy(i => i.available ? 0 : 1)
                .ThenBy(i => i.firstName)
                .ToList();

            return Ok(new
            {
                currentInterpreter1 = booking.Interpreter1,
                currentInterpreter2 = booking.Interpreter2,
                interpreters        = result,
            });
        }

        [HttpPut("{id}/assign-interpreters")]
        public async Task<IActionResult> AssignInterpreters(int id, [FromBody] AssignInterpretersDto dto)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null) return Unauthorized();
            var userRoles = await _userManager.GetRolesAsync(currentUser);
            if (!userRoles.Contains("Admin")) return Forbid();

            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.BookingId == id);
            if (booking == null) return NotFound();

            booking.Interpreter1 = string.IsNullOrWhiteSpace(dto.Interpreter1) ? null : dto.Interpreter1;
            booking.Interpreter2 = string.IsNullOrWhiteSpace(dto.Interpreter2) ? null : dto.Interpreter2;

            // Set status to "Ready" when at least one interpreter is assigned
            if (!string.IsNullOrWhiteSpace(dto.Interpreter1) || !string.IsNullOrWhiteSpace(dto.Interpreter2))
            {
                var connectionString = _context.Database.GetConnectionString();
                using var conn = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
                await conn.OpenAsync();
                using var cmd = new Microsoft.Data.SqlClient.SqlCommand(
                    "SELECT TOP 1 Id FROM BookingStatus WHERE Status LIKE '%Ready%'", conn);
                var result = await cmd.ExecuteScalarAsync();
                if (result != null && result != DBNull.Value)
                    booking.BookingStatus = Convert.ToInt32(result);
            }

            await _context.SaveChangesAsync();

            // Send interpreter-assigned notifications (only when at least one is being set)
            if (!string.IsNullOrWhiteSpace(dto.Interpreter1) || !string.IsNullOrWhiteSpace(dto.Interpreter2))
            {
                // Resolve interpreter names
                var interpNames = new List<string>();
                if (!string.IsNullOrWhiteSpace(booking.Interpreter1))
                {
                    var i = await _userManager.FindByIdAsync(booking.Interpreter1);
                    if (i != null) interpNames.Add($"{i.FirstName} {i.LastName}".Trim());
                }
                if (!string.IsNullOrWhiteSpace(booking.Interpreter2))
                {
                    var i = await _userManager.FindByIdAsync(booking.Interpreter2);
                    if (i != null) interpNames.Add($"{i.FirstName} {i.LastName}".Trim());
                }
                var interpreterDetail = interpNames.Count > 0 ? string.Join(", ", interpNames) : null;

                var customerUser = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
                var admins = (await _userManager.GetUsersInRoleAsync("Admin")).ToList();
                if (customerUser?.Email != null)
                {
                    var custName = customerUser.FirstName ?? customerUser.Email;
                    var custIntro = interpreterDetail != null
                        ? $"Great news! <strong>{interpreterDetail}</strong> has been confirmed as your interpreter for booking #{booking.BookingId}."
                        : $"Great news! An interpreter has been confirmed for your booking #{booking.BookingId}.";
                    var adminIntro = interpreterDetail != null
                        ? $"An interpreter (<strong>{interpreterDetail}</strong>) has been assigned to booking #{booking.BookingId} for <strong>{customerUser.FirstName} {customerUser.LastName}</strong>."
                        : $"An interpreter has been assigned to booking #{booking.BookingId} for <strong>{customerUser.FirstName} {customerUser.LastName}</strong>.";

                    FireBookingNotification(booking,
                        customerEmail: customerUser.Email,
                        customerName: custName,
                        admins: admins,
                        customerSubject: $"Booking #{booking.BookingId} — Interpreter Confirmed",
                        customerIntro: custIntro,
                        adminSubject: $"Interpreter assigned — Booking #{booking.BookingId}",
                        adminIntro: adminIntro
                    );
                }
            }

            return Ok();
        }

        // ── Interpreter endpoints ─────────────────────────────────────

        private async Task<List<int>> GetInterpreterBookingIds(string userId) =>
            await _context.Bookings
                .Where(b => b.Interpreter1 == userId || b.Interpreter2 == userId)
                .Select(b => b.BookingId)
                .ToListAsync();

        [HttpGet("interpreter-bookings")]
        [Authorize(Roles = "Interpreter")]
        public async Task<IActionResult> InterpreterBookings()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var ids = await GetInterpreterBookingIds(user.Id);
            var data = await _context.BookingViewDetails
                .Where(b => ids.Contains(b.BookingId))
                .OrderByDescending(b => b.BookingDate)
                .ToListAsync();
            return Ok(data);
        }

        [HttpGet("interpreter-future")]
        [Authorize(Roles = "Interpreter")]
        public async Task<IActionResult> InterpreterFuture()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var today = DateTime.UtcNow.Date;
            var ids = await GetInterpreterBookingIds(user.Id);
            var data = await _context.BookingViewDetails
                .Where(b => ids.Contains(b.BookingId)
                         && b.BookingDate >= today
                         && (b.Status == null || !b.Status.Contains("Cancel")))
                .OrderBy(b => b.BookingDate)
                .ToListAsync();
            return Ok(data);
        }

        [HttpGet("interpreter-pending")]
        [Authorize(Roles = "Interpreter")]
        public async Task<IActionResult> InterpreterPending()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var ids = await GetInterpreterBookingIds(user.Id);
            var data = await _context.BookingViewDetails
                .Where(b => ids.Contains(b.BookingId)
                         && b.Status != null && b.Status.Contains("Pending"))
                .OrderByDescending(b => b.BookingDate)
                .ToListAsync();
            return Ok(data);
        }

        [HttpGet("interpreter-cancelled")]
        [Authorize(Roles = "Interpreter")]
        public async Task<IActionResult> InterpreterCancelled()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var ids = await GetInterpreterBookingIds(user.Id);
            var data = await _context.BookingViewDetails
                .Where(b => ids.Contains(b.BookingId)
                         && b.Status != null && b.Status.Contains("Cancel"))
                .OrderByDescending(b => b.BookingDate)
                .ToListAsync();
            return Ok(data);
        }

        [HttpGet("interpreter-stats")]
        [Authorize(Roles = "Interpreter")]
        public async Task<IActionResult> InterpreterStats()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var today = DateTime.UtcNow.Date;
            var ids = await GetInterpreterBookingIds(user.Id);
            var bookings = await _context.BookingViewDetails
                .Where(b => ids.Contains(b.BookingId))
                .ToListAsync();

            return Ok(new
            {
                total     = bookings.Count,
                upcoming  = bookings.Count(b => b.BookingDate >= today && (b.Status == null || !b.Status.Contains("Cancel"))),
                pending   = bookings.Count(b => b.Status != null && b.Status.Contains("Pending")),
                cancelled = bookings.Count(b => b.Status != null && b.Status.Contains("Cancel")),
            });
        }

        // ── Email notifications ───────────────────────────────────────

        private static string BuildBookingEmail(string recipientName, string heading, string intro, int bookingId, string date, string time) => $@"
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
          <p style=""margin:0 0 8px;font-size:18px;font-weight:600;color:#0f172a;"">Hi {recipientName},</p>
          <p style=""margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;"">{intro}</p>
          <table style=""width:100%;border-collapse:collapse;"">
            <tr style=""background:#f8fafc;"">
              <td style=""padding:10px 14px;font-size:13px;font-weight:600;color:#64748b;border:1px solid #e2e8f0;width:38%;"">Booking reference</td>
              <td style=""padding:10px 14px;font-size:13px;color:#0f172a;border:1px solid #e2e8f0;"">#{bookingId}</td>
            </tr>
            <tr>
              <td style=""padding:10px 14px;font-size:13px;font-weight:600;color:#64748b;border:1px solid #e2e8f0;"">Date</td>
              <td style=""padding:10px 14px;font-size:13px;color:#0f172a;border:1px solid #e2e8f0;"">{date}</td>
            </tr>
            <tr style=""background:#f8fafc;"">
              <td style=""padding:10px 14px;font-size:13px;font-weight:600;color:#64748b;border:1px solid #e2e8f0;"">Time</td>
              <td style=""padding:10px 14px;font-size:13px;color:#0f172a;border:1px solid #e2e8f0;"">{time}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style=""background:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;"">
          <p style=""margin:0;font-size:12px;color:#94a3b8;"">Involve Interpreter &mdash; bookings@involveinterpreter.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>";

        private void FireBookingNotification(
            Booking booking,
            string customerEmail, string customerName,
            IList<ApplicationUser> admins,
            string customerSubject, string customerIntro,
            string adminSubject, string adminIntro)
        {
            var date = booking.BookingDate.HasValue
                ? booking.BookingDate.Value.ToString("dddd, d MMMM yyyy")
                : "—";
            var time = booking.BookingTime.HasValue
                ? booking.BookingTime.Value.ToString("HH:mm")
                : "—";
            var id = booking.BookingId;

            _ = Task.Run(async () =>
            {
                try
                {
                    var html = BuildBookingEmail(customerName, customerSubject, customerIntro, id, date, time);
                    await _emailService.SendAsync(customerEmail, customerSubject, html);
                }
                catch (Exception ex) { Console.WriteLine($"[Email] Booking customer notification failed: {ex.Message}"); }

                foreach (var admin in admins)
                {
                    if (string.IsNullOrWhiteSpace(admin.Email)) continue;
                    try
                    {
                        var adminName = admin.FirstName ?? "Admin";
                        var html = BuildBookingEmail(adminName, adminSubject, adminIntro, id, date, time);
                        await _emailService.SendAsync(admin.Email, adminSubject, html);
                    }
                    catch (Exception ex) { Console.WriteLine($"[Email] Booking admin notification failed: {ex.Message}"); }
                }
            });
        }

        [HttpPatch("{id}/decline")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeclineBooking(int id)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.BookingId == id);
            if (booking == null) return NotFound();

            // Resolve the unfulfilled status ID from the BookingStatus table
            int declineStatusId = 5; // fallback
            var connectionString = _context.Database.GetConnectionString();
            using (var conn = new Microsoft.Data.SqlClient.SqlConnection(connectionString))
            {
                await conn.OpenAsync();
                using var cmd = new Microsoft.Data.SqlClient.SqlCommand(
                    "SELECT TOP 1 Id FROM BookingStatus WHERE Status LIKE '%Unfulfi%'", conn);
                var result = await cmd.ExecuteScalarAsync();
                if (result != null && result != DBNull.Value)
                    declineStatusId = Convert.ToInt32(result);
            }

            booking.BookingStatus = declineStatusId;
            booking.DeclineDate    = DateTime.UtcNow;
            booking.DeclinedBy     = user.Id;

            await _context.SaveChangesAsync();

            // Notify SQOD if this booking has an associated appointment
            if (!string.IsNullOrWhiteSpace(booking.SqodAppointmentId))
            {
                _ = _sqodService.CancelAppointmentAsync(booking.SqodAppointmentId, "Booking declined — unable to fulfil");
            }

            // Email the customer only — no admin notification for declines
            var customerUser = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
            if (customerUser?.Email != null)
            {
                var custName = customerUser.FirstName ?? customerUser.Email;
                FireBookingNotification(booking,
                    customerEmail: customerUser.Email,
                    customerName: custName,
                    admins: new List<ApplicationUser>(),
                    customerSubject: $"Booking #{booking.BookingId} — Unable to fulfil",
                    customerIntro: "Unfortunately, we were unable to fulfil your booking request. Please contact us if you have any questions or would like to make an alternative arrangement.",
                    adminSubject: "",
                    adminIntro: "");
            }

            return Ok();
        }

        // ── Admin endpoints ───────────────────────────────────────────

        [HttpGet("admin-assigning")]
        public async Task<IActionResult> AdminAssigningBookings()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();
            var roles = await _userManager.GetRolesAsync(user);
            if (!roles.Contains("Admin")) return Forbid();

            var data = await _context.BookingViewDetails
                .Where(b => b.Status != null && b.Status.Contains("Assign"))
                .OrderBy(b => b.BookingDate)
                .ToListAsync();
            return Ok(data);
        }

        [HttpGet("admin-pending")]
        public async Task<IActionResult> AdminPendingBookings()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();
            var roles = await _userManager.GetRolesAsync(user);
            if (!roles.Contains("Admin")) return Forbid();

            var data = await _context.BookingViewDetails
                .Where(b => b.Status != null && b.Status.Contains("Pending"))
                .OrderByDescending(b => b.BookingDate)
                .ToListAsync();
            return Ok(data);
        }

        [HttpGet("admin-future")]
        public async Task<IActionResult> AdminFutureBookings()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();
            var roles = await _userManager.GetRolesAsync(user);
            if (!roles.Contains("Admin")) return Forbid();

            var today = DateTime.UtcNow.Date;
            var data = await _context.BookingViewDetails
                .Where(b => b.BookingDate >= today && (b.Status == null || !b.Status.Contains("Cancel")))
                .OrderBy(b => b.BookingDate)
                .ToListAsync();
            return Ok(data);
        }

        [HttpGet("admin-cancelled")]
        public async Task<IActionResult> AdminCancelledBookings()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();
            var roles = await _userManager.GetRolesAsync(user);
            if (!roles.Contains("Admin")) return Forbid();

            var data = await _context.BookingViewDetails
                .Where(b => b.Status != null && b.Status.Contains("Cancel"))
                .OrderByDescending(b => b.BookingDate)
                .ToListAsync();
            return Ok(data);
        }

        [HttpGet("admin-stats")]
        public async Task<IActionResult> AdminStats()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();
            var roles = await _userManager.GetRolesAsync(user);
            if (!roles.Contains("Admin")) return Forbid();

            var connectionString = _context.Database.GetConnectionString();
            using var conn = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
            await conn.OpenAsync();

            const string sql = @"
                SELECT
                    (SELECT COUNT(*) FROM Booking) AS Total,
                    (SELECT COUNT(*) FROM Booking b
                        JOIN BookingStatus s ON b.BookingStatus = s.Id
                        WHERE s.Status LIKE '%Pending%') AS Pending,
                    (SELECT COUNT(*) FROM Booking b
                        JOIN BookingStatus s ON b.BookingStatus = s.Id
                        WHERE b.BookingDate >= CAST(GETDATE() AS DATE)
                          AND s.Status NOT LIKE '%Cancel%') AS Upcoming,
                    (SELECT COUNT(*) FROM Booking
                        WHERE MONTH(BookingDate) = MONTH(GETDATE())
                          AND YEAR(BookingDate) = YEAR(GETDATE())) AS ThisMonth;";

            using var cmd = new Microsoft.Data.SqlClient.SqlCommand(sql, conn);
            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return Ok(new
                {
                    total     = reader.GetInt32(0),
                    pending   = reader.GetInt32(1),
                    upcoming  = reader.GetInt32(2),
                    thisMonth = reader.GetInt32(3),
                });
            }

            return Ok(new { total = 0, pending = 0, upcoming = 0, thisMonth = 0 });
        }
    }
}
