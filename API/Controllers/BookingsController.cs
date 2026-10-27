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
        private readonly GraphCalendarService _graphCalendar;
        private readonly IConfiguration _config;
        private readonly IWebHostEnvironment _env;

        public BookingsController(ApplicationDbContext context, UserManager<ApplicationUser> userManager, BookingService bookingService, EmailService emailService, SqodService sqodService, GraphCalendarService graphCalendar, IConfiguration config, IWebHostEnvironment env)
        {
            _context = context;
            _userManager = userManager;
            _bookingService = bookingService;
            _emailService = emailService;
            _sqodService = sqodService;
            _graphCalendar = graphCalendar;
            _config = config;
            _env = env;
        }

        /// <summary>
        /// Records one row in the booking's activity history. Called directly
        /// after whatever mutation it describes, so it only ever logs something
        /// that genuinely happened — never speculative/pending state.
        /// </summary>
        private async Task LogAuditAsync(int bookingId, string eventType, string summary, string? details, ApplicationUser? actor)
        {
            _context.BookingAuditLogs.Add(new BookingAuditLogEntry
            {
                BookingId = bookingId,
                EventType = eventType,
                Summary = summary,
                Details = details,
                ActorUserId = actor?.Id,
                ActorName = actor != null ? $"{actor.FirstName} {actor.LastName}".Trim() : null,
                CreatedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync();
        }

        private static string? RenderChanges(List<(string Field, string? OldValue, string? NewValue)> changes) =>
            changes.Count == 0 ? null : string.Join(Environment.NewLine, changes.Select(c => $"{c.Field}: {c.OldValue ?? "—"} → {c.NewValue ?? "—"}"));

        /// <summary>
        /// Admin + Super Admin accounts, deduplicated (one account can hold both
        /// roles), minus anyone who has personally opted out of booking
        /// notification emails via their own account preference.
        /// </summary>
        private async Task<List<ApplicationUser>> GetNotifiableAdminsAsync()
        {
            var admins = await _userManager.GetUsersInRoleAsync("Admin");
            var superAdmins = await _userManager.GetUsersInRoleAsync("Super Admin");
            return admins.Concat(superAdmins)
                .GroupBy(u => u.Id)
                .Select(g => g.First())
                .ToList();
        }

        private async Task<List<ApplicationUser>> GetInterpreterUsersAsync(Booking booking)
        {
            var list = new List<ApplicationUser>();
            if (!string.IsNullOrWhiteSpace(booking.Interpreter1))
            {
                var i = await _userManager.FindByIdAsync(booking.Interpreter1);
                if (i != null) list.Add(i);
            }
            if (!string.IsNullOrWhiteSpace(booking.Interpreter2))
            {
                var i = await _userManager.FindByIdAsync(booking.Interpreter2);
                if (i != null) list.Add(i);
            }
            return list;
        }

        private async Task<int?> GetDurationMinutesAsync(Booking booking)
        {
            if (!booking.DurationId.HasValue) return null;
            var dur = await _context.Duration.FindAsync(booking.DurationId.Value);
            if (dur != null && int.TryParse(dur.DurationValue, out var mins)) return mins;
            return null;
        }

        private string? GetLogoDataUri()
        {
            var path = Path.Combine(_env.WebRootPath ?? "", "logo.png");
            if (!System.IO.File.Exists(path)) return null;
            var bytes = System.IO.File.ReadAllBytes(path);
            return $"data:image/png;base64,{Convert.ToBase64String(bytes)}";
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

            int? bookedMins = null;
            if (booking.DurationId.HasValue)
            {
                var dur = await _context.Duration.FindAsync(booking.DurationId.Value);
                if (dur != null && int.TryParse(dur.DurationValue, out var m)) bookedMins = m;
            }

            int? chargedMins = null;
            if (booking.NoShow == true)
            {
                chargedMins = bookedMins;
            }
            else if (booking.ActualMins.HasValue)
            {
                chargedMins = bookedMins.HasValue
                    ? Math.Max(booking.ActualMins.Value, bookedMins.Value)
                    : booking.ActualMins.Value;
            }

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
                booking.customerURL,
                booking.DeafName,
                booking.ProfessionalName,
                booking.ProfessionalEmail,
                booking.CustomerRef,
                booking.Attendees,
                booking.PrepContactName,
                booking.PrepContactEmail,
                booking.CustId,
                booking.CancelComments,
                booking.CancelDate,
                booking.CancelledBy,
                booking.DeclineComments,
                booking.DeclineDate,
                booking.DeclinedBy,
                booking.ActualMins,
                booking.NoShow,
                booking.InterpreterNotes,
                BookedMins = bookedMins,
                ChargedMins = chargedMins
            };

            Console.WriteLine("Booking returned successfully");
            return Ok(result);
        }

        // GET: api/bookings/{id}/audit-log — admin only. Newest first, so the
        // most recent thing that happened is the first thing an admin reads.
        [HttpGet("{id}/audit-log")]
        [Authorize(Roles = "Admin,Super Admin")]
        public async Task<IActionResult> GetBookingAuditLog(int id)
        {
            var exists = await _context.Bookings.AnyAsync(b => b.BookingId == id);
            if (!exists) return NotFound();

            var entries = await _context.BookingAuditLogs
                .Where(a => a.BookingId == id)
                .OrderByDescending(a => a.CreatedAt)
                .ThenByDescending(a => a.Id)
                .Select(a => new
                {
                    a.EventType,
                    a.Summary,
                    a.Details,
                    a.ActorName,
                    a.CreatedAt,
                })
                .ToListAsync();

            return Ok(entries);
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
                    VideoUrl = dto.VideoUrl,
                    DeafName = dto.DeafName,
                    ProfessionalName = dto.ProfessionalName,
                    ProfessionalEmail = dto.ProfessionalEmail,
                    CustomerRef = dto.CustomerRef,
                    Attendees = dto.Attendees,
                    PrepContactName = dto.PrepContactName,
                    PrepContactEmail = dto.PrepContactEmail
                };
                _context.Bookings.Add(booking);
                await _context.SaveChangesAsync();
                Console.WriteLine(booking);

                await LogAuditAsync(booking.BookingId, "Created", "Booking created", null, user);

                var customerUser = await _userManager.FindByIdAsync(targetUserId);

                // SQOD appointment is now created later, when an interpreter is assigned.

                // Create shared-calendar event in Outlook/Exchange
                {
                    var (durLabel, bTypeLabel) = await ResolveBookingLabelsAsync(booking);
                    var company = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;
                    var durMins = await GetDurationMinutesAsync(booking);
                    var interpreters = await GetInterpreterUsersAsync(booking);
                    var eventId = await _graphCalendar.CreateEventAsync(
                        booking, customerUser, company?.Name, durLabel, bTypeLabel, durMins, interpreters);
                    if (!string.IsNullOrWhiteSpace(eventId))
                    {
                        booking.OutlookID = eventId;
                        await _context.SaveChangesAsync();
                    }
                }

                // Send booking-created notifications
                var admins = await GetNotifiableAdminsAsync();
                if (customerUser?.Email != null)
                {
                    var custName = customerUser.FirstName ?? customerUser.Email;
                    var (dur, bType) = await ResolveBookingLabelsAsync(booking);
                    var company = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;
                    FireBookingNotification(booking,
                        customerEmail: customerUser.Email,
                        customerName: custName,
                        admins: admins,
                        customerSubject: $"Booking #{booking.BookingId} — Received",
                        customerIntro: "Thank you for your booking. We have received your request and will be in touch shortly to confirm your interpreter.",
                        adminSubject: $"New booking #{booking.BookingId} — {custName}",
                        adminIntro: $"A new booking has been submitted by <strong>{customerUser.FirstName} {customerUser.LastName}</strong>.",
                        duration: dur, bookingType: bType,
                        companyName: company?.Name
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

            // Snapshotted before mutation so the admin/interpreter notification
            // emails and the audit log can show what actually changed, not just
            // the new values. The email diff only needs the first five (the ones
            // that affect attending); the audit log covers every editable field.
            var oldBookingDate = booking.BookingDate;
            var oldBookingTime = booking.BookingTime;
            var oldDurationId = booking.DurationId;
            var oldBookingTypeId = booking.BookingType;
            var oldVideoUrl = booking.VideoUrl;
            var oldContactEmail = booking.ContactEmail;
            var oldContactNumber = booking.ContactNumber;
            var oldAddInfo = booking.AddInfo;
            var oldDeafName = booking.DeafName;
            var oldProfessionalName = booking.ProfessionalName;
            var oldProfessionalEmail = booking.ProfessionalEmail;
            var oldCustomerRef = booking.CustomerRef;
            var oldAttendees = booking.Attendees;
            var oldPrepContactName = booking.PrepContactName;
            var oldPrepContactEmail = booking.PrepContactEmail;

            booking.BookingDate = dto.BookingDate;
            booking.BookingTime = dto.BookingTime;
            booking.DurationId = dto.DurationId;
            booking.BookingType = dto.BookingType;
            booking.ContactEmail = dto.ContactEmail;
            booking.ContactNumber = dto.ContactNumber;
            booking.AddInfo = dto.AddInfo;
            booking.VideoUrl = dto.VideoUrl;
            booking.DeafName = dto.DeafName;
            booking.ProfessionalName = dto.ProfessionalName;
            booking.ProfessionalEmail = dto.ProfessionalEmail;
            booking.CustomerRef = dto.CustomerRef;
            booking.Attendees = dto.Attendees;
            booking.PrepContactName = dto.PrepContactName;
            booking.PrepContactEmail = dto.PrepContactEmail;

            // If the date or time has changed while an interpreter is assigned,
            // nobody has confirmed they're actually free at the new slot — clear
            // the assignment and put the booking back to Pending for
            // re-assignment, rather than silently keep them booked against a
            // time they were never checked against. Done before the save so the
            // Outlook/SQOD sync below (which reads the interpreter list) already
            // reflects the booking being unassigned.
            var dateOrTimeChanged =
                FormatBookingDate(oldBookingDate) != FormatBookingDate(booking.BookingDate) ||
                FormatBookingTime(oldBookingTime) != FormatBookingTime(booking.BookingTime);
            var clearedInterpreter1Id = booking.Interpreter1;
            var clearedInterpreter2Id = booking.Interpreter2;
            var hadInterpreterAssigned = !string.IsNullOrWhiteSpace(clearedInterpreter1Id) || !string.IsNullOrWhiteSpace(clearedInterpreter2Id);
            var clearedInterpretersForReschedule = dateOrTimeChanged && hadInterpreterAssigned;

            if (clearedInterpretersForReschedule)
            {
                booking.Interpreter1 = null;
                booking.Interpreter2 = null;

                int pendingStatusId = 3; // fallback — "Pending" as seeded in BookingStatus
                var pendingConnStr = _context.Database.GetConnectionString();
                using (var conn = new Microsoft.Data.SqlClient.SqlConnection(pendingConnStr))
                {
                    await conn.OpenAsync();
                    using var cmd = new Microsoft.Data.SqlClient.SqlCommand(
                        "SELECT TOP 1 Id FROM BookingStatus WHERE Status LIKE '%Pending%'", conn);
                    var result = await cmd.ExecuteScalarAsync();
                    if (result != null && result != DBNull.Value)
                        pendingStatusId = Convert.ToInt32(result);
                }
                booking.BookingStatus = pendingStatusId;
            }

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

            // Sync updated details to Outlook/Exchange calendar
            if (!string.IsNullOrWhiteSpace(booking.OutlookID))
            {
                var customerUser3 = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
                var (durLabel, bTypeLabel) = await ResolveBookingLabelsAsync(booking);
                var company = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;
                var durMins = await GetDurationMinutesAsync(booking);
                var interpreters = await GetInterpreterUsersAsync(booking);
                _ = _graphCalendar.UpdateEventAsync(
                    booking.OutlookID, booking, customerUser3, company?.Name, durLabel, bTypeLabel, durMins, interpreters);
            }

            // Field-level diff for the admin and interpreter copies — never shown
            // to the customer, who just sees the current details as before. Scoped
            // to the fields that affect attending; see BuildChangeSummaryAsync.
            var changes = await BuildChangeSummaryAsync(
                oldBookingDate, booking.BookingDate,
                oldBookingTime, booking.BookingTime,
                oldDurationId, booking.DurationId,
                oldBookingTypeId, booking.BookingType,
                oldVideoUrl, booking.VideoUrl);

            // Audit log covers every editable field, not just the attendance-
            // relevant subset used for the email — "what happened" should be the
            // complete picture, even for a contact-detail-only edit nobody is
            // emailed about.
            var auditChanges = new List<(string Field, string? OldValue, string? NewValue)>(changes);
            void AddPlainChange(string field, string? oldValue, string? newValue)
            {
                if (!string.Equals(oldValue, newValue, StringComparison.Ordinal))
                    auditChanges.Add((field, oldValue, newValue));
            }
            AddPlainChange("Contact email", oldContactEmail, booking.ContactEmail);
            AddPlainChange("Contact number", oldContactNumber, booking.ContactNumber);
            AddPlainChange("Additional info", oldAddInfo, booking.AddInfo);
            AddPlainChange("Deaf attendee", oldDeafName, booking.DeafName);
            AddPlainChange("Professional name", oldProfessionalName, booking.ProfessionalName);
            AddPlainChange("Professional email", oldProfessionalEmail, booking.ProfessionalEmail);
            AddPlainChange("Customer ref", oldCustomerRef, booking.CustomerRef);
            AddPlainChange("Attendees", oldAttendees?.ToString(), booking.Attendees?.ToString());
            AddPlainChange("Prep contact name", oldPrepContactName, booking.PrepContactName);
            AddPlainChange("Prep contact email", oldPrepContactEmail, booking.PrepContactEmail);
            if (auditChanges.Count > 0)
                await LogAuditAsync(booking.BookingId, "Updated", "Details updated", RenderChanges(auditChanges), user);

            if (clearedInterpretersForReschedule)
            {
                async Task<string> NameOrUnknownAsync(string? userId)
                {
                    if (string.IsNullOrWhiteSpace(userId)) return null!;
                    var u = await _userManager.FindByIdAsync(userId);
                    return u != null ? $"{u.FirstName} {u.LastName}".Trim() : "Unknown";
                }
                var clearedNames = new List<string>();
                var n1 = await NameOrUnknownAsync(clearedInterpreter1Id);
                if (n1 != null) clearedNames.Add(n1);
                var n2 = await NameOrUnknownAsync(clearedInterpreter2Id);
                if (n2 != null) clearedNames.Add(n2);

                await LogAuditAsync(booking.BookingId, "Unassigned",
                    "Interpreter(s) unassigned — date/time changed, booking now pending",
                    clearedNames.Count > 0 ? string.Join(", ", clearedNames) : null,
                    user);
            }

            // Send booking-updated notifications
            var customerUser = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
            var admins = await GetNotifiableAdminsAsync();
            if (customerUser?.Email != null)
            {
                var custName = customerUser.FirstName ?? customerUser.Email;
                var (dur, bType) = await ResolveBookingLabelsAsync(booking);
                var company = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;

                var customerIntro = "Your booking details have been updated. Please see the summary below.";
                var adminIntro = $"Booking #{booking.BookingId} has been updated for <strong>{customerUser.FirstName} {customerUser.LastName}</strong>.";
                if (clearedInterpretersForReschedule)
                {
                    customerIntro += " Because the date or time has changed, the previously assigned interpreter has been unassigned and we're arranging a replacement.";
                    adminIntro += " <strong>The date/time changed, so the assigned interpreter was automatically unassigned and the booking is now Pending re-assignment.</strong>";
                }

                FireBookingNotification(booking,
                    customerEmail: customerUser.Email,
                    customerName: custName,
                    admins: admins,
                    customerSubject: $"Booking #{booking.BookingId} — Updated",
                    customerIntro: customerIntro,
                    adminSubject: clearedInterpretersForReschedule
                        ? $"Booking #{booking.BookingId} updated — now Pending re-assignment — {custName}"
                        : $"Booking #{booking.BookingId} updated — {custName}",
                    adminIntro: adminIntro,
                    duration: dur, bookingType: bType,
                    companyName: company?.Name,
                    changes: changes
                );
            }

            // Tell any already-assigned interpreter when something they'd need to
            // know about has changed. There was previously no notification at all
            // for this — only the initial assignment email — so an interpreter's
            // date/time could change with no notice to them.
            if (changes.Count > 0)
            {
                var interpreterUsers = await GetInterpreterUsersAsync(booking);
                var (dur, bType) = await ResolveBookingLabelsAsync(booking);
                var date = booking.BookingDate.HasValue ? booking.BookingDate.Value.ToString("dddd, d MMMM yyyy") : "—";
                var time = booking.BookingTime.HasValue ? booking.BookingTime.Value.ToString("HH:mm") : "—";
                var company = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;

                foreach (var interpreter in interpreterUsers)
                {
                    if (string.IsNullOrWhiteSpace(interpreter.Email)) continue;
                    var interpName = $"{interpreter.FirstName} {interpreter.LastName}".Trim();
                    var subject = $"Booking #{booking.BookingId} — Details updated";
                    var intro = "The details for a booking you're assigned to have changed. Please see what's updated below.";
                    var html = BuildBookingEmail(interpName, subject, intro, booking.BookingId, date, time,
                        duration: dur, bookingType: bType,
                        videoUrl: booking.VideoUrl, contactEmail: booking.ContactEmail,
                        companyName: company?.Name, contactName: booking.ContactName,
                        deafName: booking.DeafName, professionalName: booking.ProfessionalName,
                        professionalEmail: booking.ProfessionalEmail, customerRef: booking.CustomerRef,
                        addInfo: booking.AddInfo, attendees: booking.Attendees,
                        prepContactName: booking.PrepContactName, prepContactEmail: booking.PrepContactEmail,
                        changes: changes);
                    _ = Task.Run(async () =>
                    {
                        try { await _emailService.SendAsync(interpreter.Email, subject, html); }
                        catch (Exception ex) { Console.WriteLine($"[Email] Interpreter update notification failed: {ex.Message}"); }
                    });
                }
            }

            // Tell whoever was just unassigned why — silently dropping someone
            // from a booking they thought they still had is worse than this
            // being automatic in the first place.
            if (clearedInterpretersForReschedule)
            {
                var (dur, bType) = await ResolveBookingLabelsAsync(booking);
                var date = booking.BookingDate.HasValue ? booking.BookingDate.Value.ToString("dddd, d MMMM yyyy") : "—";
                var time = booking.BookingTime.HasValue ? booking.BookingTime.Value.ToString("HH:mm") : "—";
                var company = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;

                foreach (var clearedId in new[] { clearedInterpreter1Id, clearedInterpreter2Id })
                {
                    if (string.IsNullOrWhiteSpace(clearedId)) continue;
                    var removedInterpreter = await _userManager.FindByIdAsync(clearedId);
                    if (removedInterpreter?.Email == null) continue;

                    var interpName = $"{removedInterpreter.FirstName} {removedInterpreter.LastName}".Trim();
                    var subject = $"Booking #{booking.BookingId} — You've been unassigned";
                    var intro = "The date or time for this booking has changed, so you've been unassigned and it's now pending re-assignment. You don't need to do anything further for this booking unless you're assigned to it again.";
                    var html = BuildBookingEmail(interpName, subject, intro, booking.BookingId, date, time,
                        duration: dur, bookingType: bType,
                        videoUrl: booking.VideoUrl, contactEmail: booking.ContactEmail,
                        companyName: company?.Name, contactName: booking.ContactName,
                        deafName: booking.DeafName, professionalName: booking.ProfessionalName,
                        professionalEmail: booking.ProfessionalEmail, customerRef: booking.CustomerRef,
                        addInfo: booking.AddInfo, attendees: booking.Attendees,
                        prepContactName: booking.PrepContactName, prepContactEmail: booking.PrepContactEmail,
                        changes: changes);
                    _ = Task.Run(async () =>
                    {
                        try { await _emailService.SendAsync(removedInterpreter.Email, subject, html); }
                        catch (Exception ex) { Console.WriteLine($"[Email] Interpreter unassignment notification failed: {ex.Message}"); }
                    });
                }
            }

            return Ok(booking);
        }

        public class CancelBookingDto
        {
            public string? Reason { get; set; }
        }

        [HttpPatch("{id}/cancel")]
        public async Task<IActionResult> CancelBooking(int id, [FromBody] CancelBookingDto? dto = null)
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
            booking.CancelComments = dto?.Reason;

            await _context.SaveChangesAsync();
            await LogAuditAsync(booking.BookingId, "Cancelled", "Booking cancelled", dto?.Reason, user);

            // Notify SQOD if this booking has an associated appointment
            if (!string.IsNullOrWhiteSpace(booking.SqodAppointmentId))
            {
                _ = _sqodService.CancelAppointmentAsync(booking.SqodAppointmentId, "Booking cancelled via BSL portal");
            }

            // Remove or rename the Outlook/Exchange calendar event
            if (!string.IsNullOrWhiteSpace(booking.OutlookID))
            {
                var hadInterpreter = !string.IsNullOrWhiteSpace(booking.Interpreter1)
                                  || !string.IsNullOrWhiteSpace(booking.Interpreter2);

                if (!hadInterpreter)
                {
                    var deleted = await _graphCalendar.DeleteEventAsync(booking.OutlookID, booking.BookingId);
                    if (deleted)
                    {
                        booking.OutlookID = null;
                        await _context.SaveChangesAsync();
                    }
                }
                else
                {
                    var customerUserC = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
                    var (durLabelC, bTypeLabelC) = await ResolveBookingLabelsAsync(booking);
                    var companyC = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;
                    var durMinsC = await GetDurationMinutesAsync(booking);
                    var interpretersC = await GetInterpreterUsersAsync(booking);
                    _ = _graphCalendar.UpdateEventAsync(
                        booking.OutlookID, booking, customerUserC, companyC?.Name, durLabelC, bTypeLabelC, durMinsC, interpretersC,
                        cancelled: true);
                }
            }

            // Send cancellation email notifications
            var customerUser = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
            var admins = await GetNotifiableAdminsAsync();
            if (customerUser?.Email != null)
            {
                var custName = customerUser.FirstName ?? customerUser.Email;
                var cancelledBy = roles.Contains("Admin") ? "an administrator" : "you";
                var (dur, bType) = await ResolveBookingLabelsAsync(booking);
                var company = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;
                var reasonLine = !string.IsNullOrWhiteSpace(booking.CancelComments)
                    ? $" Reason: <strong>{System.Net.WebUtility.HtmlEncode(booking.CancelComments)}</strong>."
                    : string.Empty;
                FireBookingNotification(booking,
                    customerEmail: customerUser.Email,
                    customerName: custName,
                    admins: admins,
                    customerSubject: $"Booking #{booking.BookingId} — Cancelled",
                    customerIntro: $"Your booking has been cancelled by {cancelledBy}.{reasonLine} If this was unexpected, please contact us.",
                    adminSubject: $"Booking #{booking.BookingId} cancelled — {custName}",
                    adminIntro: $"Booking #{booking.BookingId} for <strong>{customerUser.FirstName} {customerUser.LastName}</strong> has been cancelled.{reasonLine}",
                    duration: dur, bookingType: bType,
                    companyName: company?.Name);
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

        [HttpGet("calendar-interpreter")]
        [Authorize(Roles = "Interpreter")]
        public async Task<IActionResult> CalendarInterpreter()
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
                var events = await _bookingService.GetInterpreterCalendarViewAsync(userId);
                return Ok(events);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"CalendarInterpreter error: {ex.Message}\n{ex.StackTrace}");
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

            var oldInterpreter1Id = booking.Interpreter1;
            var oldInterpreter2Id = booking.Interpreter2;

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

            if (oldInterpreter1Id != booking.Interpreter1 || oldInterpreter2Id != booking.Interpreter2)
            {
                async Task<string> NameOrNoneAsync(string? userId)
                {
                    if (string.IsNullOrWhiteSpace(userId)) return "none";
                    var u = await _userManager.FindByIdAsync(userId);
                    return u != null ? $"{u.FirstName} {u.LastName}".Trim() : "none";
                }

                var assignChanges = new List<(string Field, string? OldValue, string? NewValue)>();
                var oldInt1Name = await NameOrNoneAsync(oldInterpreter1Id);
                var newInt1Name = await NameOrNoneAsync(booking.Interpreter1);
                if (oldInt1Name != newInt1Name) assignChanges.Add(("Interpreter 1", oldInt1Name, newInt1Name));
                var oldInt2Name = await NameOrNoneAsync(oldInterpreter2Id);
                var newInt2Name = await NameOrNoneAsync(booking.Interpreter2);
                if (oldInt2Name != newInt2Name) assignChanges.Add(("Interpreter 2", oldInt2Name, newInt2Name));

                await LogAuditAsync(booking.BookingId, "Assigned", "Interpreter assignment changed", RenderChanges(assignChanges), currentUser);
            }

            var hasInterpreterAssigned = !string.IsNullOrWhiteSpace(booking.Interpreter1)
                                      || !string.IsNullOrWhiteSpace(booking.Interpreter2);

            // Create the SQOD appointment now that an interpreter has been assigned (only on first assignment)
            if (hasInterpreterAssigned
                && string.IsNullOrWhiteSpace(booking.SqodAppointmentId)
                && string.IsNullOrWhiteSpace(booking.VideoUrl)
                && !string.IsNullOrWhiteSpace(booking.UserId))
            {
                var customerUserSqod = await _userManager.FindByIdAsync(booking.UserId);
                if (customerUserSqod != null)
                {
                    var durationMinsSqod = await GetDurationMinutesAsync(booking);
                    var sqodResult = await _sqodService.CreateAppointmentAsync(booking, customerUserSqod, durationMinsSqod);
                    if (sqodResult != null)
                    {
                        booking.VideoUrl          = sqodResult.CustomerUrl;
                        booking.customerURL       = sqodResult.RoomUrl;
                        booking.SqodAppointmentId = sqodResult.AppointmentId;
                        await _context.SaveChangesAsync();
                    }
                }
            }

            // Sync interpreter assignment to the Outlook/Exchange event
            if (!string.IsNullOrWhiteSpace(booking.OutlookID))
            {
                var customerUserA = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
                var (durLabelA, bTypeLabelA) = await ResolveBookingLabelsAsync(booking);
                var companyA = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;
                var durMinsA = await GetDurationMinutesAsync(booking);
                var interpretersA = await GetInterpreterUsersAsync(booking);
                _ = _graphCalendar.UpdateEventAsync(
                    booking.OutlookID, booking, customerUserA, companyA?.Name, durLabelA, bTypeLabelA, durMinsA, interpretersA);
            }

            // Send interpreter-assigned notifications (only when at least one is being set)
            if (!string.IsNullOrWhiteSpace(dto.Interpreter1) || !string.IsNullOrWhiteSpace(dto.Interpreter2))
            {
                // Resolve interpreter user objects (need both name and email)
                var interpreterUsers = new List<ApplicationUser>();
                if (!string.IsNullOrWhiteSpace(booking.Interpreter1))
                {
                    var i = await _userManager.FindByIdAsync(booking.Interpreter1);
                    if (i != null) interpreterUsers.Add(i);
                }
                if (!string.IsNullOrWhiteSpace(booking.Interpreter2))
                {
                    var i = await _userManager.FindByIdAsync(booking.Interpreter2);
                    if (i != null) interpreterUsers.Add(i);
                }

                var interpNames = interpreterUsers.Select(i => $"{i.FirstName} {i.LastName}".Trim()).ToList();
                var interpreterDetail = interpNames.Count > 0 ? string.Join(", ", interpNames) : null;

                var customerUser = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
                var admins = await GetNotifiableAdminsAsync();

                var (dur, bType) = await ResolveBookingLabelsAsync(booking);
                var company = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;
                var compName = company?.Name;

                // Notify customer and admins
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
                        adminIntro: adminIntro,
                        duration: dur, bookingType: bType,
                        companyName: compName
                    );
                }

                // Notify each assigned interpreter
                var customerName = customerUser != null
                    ? $"{customerUser.FirstName} {customerUser.LastName}".Trim()
                    : "a customer";
                var date = booking.BookingDate.HasValue ? booking.BookingDate.Value.ToString("dddd, d MMMM yyyy") : "—";
                var time = booking.BookingTime.HasValue ? booking.BookingTime.Value.ToString("HH:mm") : "—";

                foreach (var interpreter in interpreterUsers)
                {
                    if (string.IsNullOrWhiteSpace(interpreter.Email)) continue;
                    var interpName = $"{interpreter.FirstName} {interpreter.LastName}".Trim();
                    var subject = $"Booking #{booking.BookingId} — You have been assigned";
                    var intro = $"You have been assigned as an interpreter for a booking on behalf of <strong>{customerName}</strong>.";
                    var html = BuildBookingEmail(interpName, subject, intro, booking.BookingId, date, time,
                        duration: dur, bookingType: bType,
                        videoUrl: booking.VideoUrl, contactEmail: booking.ContactEmail,
                        companyName: compName, contactName: booking.ContactName,
                        deafName: booking.DeafName, professionalName: booking.ProfessionalName,
                        professionalEmail: booking.ProfessionalEmail, customerRef: booking.CustomerRef,
                        addInfo: booking.AddInfo, attendees: booking.Attendees,
                        prepContactName: booking.PrepContactName, prepContactEmail: booking.PrepContactEmail);
                    _ = Task.Run(async () =>
                    {
                        try { await _emailService.SendAsync(interpreter.Email, subject, html); }
                        catch (Exception ex) { Console.WriteLine($"[Email] Interpreter notification failed: {ex.Message}"); }
                    });
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

        public class LogTimeDto
        {
            public bool NoShow { get; set; }
            public int? ActualMins { get; set; }
            public string? Notes { get; set; }
        }

        [HttpPatch("{id}/log-time")]
        [Authorize(Roles = "Interpreter")]
        public async Task<IActionResult> LogTime(int id, [FromBody] LogTimeDto dto)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.BookingId == id);
            if (booking == null) return NotFound();

            if (booking.Interpreter1 != user.Id && booking.Interpreter2 != user.Id)
                return Forbid();

            if (dto.NoShow)
            {
                if (string.IsNullOrWhiteSpace(dto.Notes))
                    return BadRequest(new { error = "Notes are required for a no-show." });
                booking.NoShow = true;
                booking.ActualMins = null;
                booking.InterpreterNotes = dto.Notes.Trim();
            }
            else
            {
                if (!dto.ActualMins.HasValue || dto.ActualMins.Value <= 0)
                    return BadRequest(new { error = "Actual minutes are required." });
                booking.NoShow = false;
                booking.ActualMins = dto.ActualMins.Value;
                booking.InterpreterNotes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();
            }

            // Resolve a "Complete" status if one exists in BookingStatus
            var connectionString = _context.Database.GetConnectionString();
            using (var conn = new Microsoft.Data.SqlClient.SqlConnection(connectionString))
            {
                await conn.OpenAsync();
                using var cmd = new Microsoft.Data.SqlClient.SqlCommand(
                    "SELECT TOP 1 Id FROM BookingStatus WHERE Status LIKE '%Complete%'", conn);
                var result = await cmd.ExecuteScalarAsync();
                if (result != null && result != DBNull.Value)
                    booking.BookingStatus = Convert.ToInt32(result);
            }

            await _context.SaveChangesAsync();

            if (dto.NoShow)
                await LogAuditAsync(booking.BookingId, "NoShow", "Marked as no-show", booking.InterpreterNotes, user);
            else
                await LogAuditAsync(booking.BookingId, "TimeLogged", $"Time logged: {booking.ActualMins} minutes", booking.InterpreterNotes, user);

            return Ok(new
            {
                booking.BookingId,
                booking.NoShow,
                booking.ActualMins,
                booking.InterpreterNotes,
            });
        }

        // ── Email notifications ───────────────────────────────────────

        private string BuildBookingEmail(
            string recipientName, string heading, string intro,
            int bookingId, string date, string time,
            string? duration = null, string? bookingType = null,
            string? videoUrl = null, string? contactEmail = null,
            string? companyName = null, string? contactName = null,
            string? deafName = null, string? professionalName = null,
            string? professionalEmail = null, string? customerRef = null,
            string? addInfo = null, int? attendees = null,
            string? prepContactName = null, string? prepContactEmail = null,
            List<(string Field, string? OldValue, string? NewValue)>? changes = null)
        {
            // "What's changed" callout — admin/interpreter copies only (the caller
            // simply never passes changes for the customer copy). Rendered above the
            // current-state details table so the change is the first thing read.
            var changesBlock = "";
            if (changes != null && changes.Count > 0)
            {
                var rows = new System.Text.StringBuilder();
                foreach (var c in changes)
                {
                    rows.Append($@"
            <p style=""margin:0 0 6px 0;font-family:Arial,sans-serif;font-size:13px;color:#1e3a5f;""><strong>{c.Field}:</strong> <span style=""text-decoration:line-through;color:#64748b;"">{c.OldValue ?? "—"}</span> &rarr; <strong style=""color:#0f172a;"">{c.NewValue ?? "—"}</strong></p>");
                }
                changesBlock = $@"
            <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""margin:0 0 24px 0;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;"">
              <tr><td style=""padding:14px 18px;"">
                <p style=""margin:0 0 8px 0;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#1e40af;text-transform:uppercase;letter-spacing:0.05em;"">What's changed</p>
                {rows}
              </td></tr>
            </table>";
            }

            // Build optional extra rows — alternating colours continuing from Time row
            var logoSrc = GetLogoDataUri() ?? "";
            var extraRows = new System.Text.StringBuilder();
            var light = true; // Time ends on #f8fafc, so next (Duration) is #ffffff
            void AddRow(string label, string? value, bool isLink = false)
            {
                if (string.IsNullOrWhiteSpace(value)) return;
                var bg = light ? "#ffffff" : "#f8fafc";
                light = !light;
                var cell = isLink
                    ? $@"<a href=""{value}"" style=""color:#0057b8;word-break:break-all;font-family:Arial,sans-serif;font-size:13px;"">{value}</a>"
                    : $@"<span style=""font-family:Arial,sans-serif;font-size:13px;color:#0f172a;"">{value}</span>";
                extraRows.Append($@"
              <tr>
                <td bgcolor=""{bg}"" style=""padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#64748b;border:1px solid #e2e8f0;border-top:none;"">{label}</td>
                <td bgcolor=""{bg}"" style=""padding:10px 14px;border:1px solid #e2e8f0;border-left:none;border-top:none;"">{cell}</td>
              </tr>");
            }
            AddRow("Company",       companyName);
            AddRow("Duration",      duration);
            AddRow("Booking type",  bookingType);
            AddRow("Contact name",  contactName);
            AddRow("Contact email", contactEmail);
            AddRow("Deaf attendee", deafName);
            AddRow("Professional name",  professionalName);
            AddRow("Professional email", professionalEmail);
            AddRow("Customer Ref/PO",    customerRef);
            AddRow("Video URL",     videoUrl,     isLink: true);
            AddRow("Additional info", addInfo);

            // Conditional group/event fields
            var isGroupOrEvent = bookingType != null && System.Text.RegularExpressions.Regex.IsMatch(bookingType, @"team|group|event|webinar", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (isGroupOrEvent)
            {
                AddRow("Number of attendees", attendees?.ToString());
                AddRow("Prep contact name",   prepContactName);
                AddRow("Prep contact email",  prepContactEmail);
            }

            return $@"
<!DOCTYPE html>
<html lang=""en"">
<head><meta charset=""UTF-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1""><title>{heading}</title></head>
<body style=""margin:0;padding:0;background-color:#f8fafc;"">
  <!--[if mso]><table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0""><tr><td align=""center"" style=""padding:40px 0;""><![endif]-->
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""background-color:#f8fafc;"">
    <tr><td align=""center"" style=""padding:40px 16px;"">

      <!-- Card -->
      <table role=""presentation"" width=""560"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""width:560px;max-width:100%;background-color:#ffffff;border:1px solid #e2e8f0;"">

        <!-- Header -->
        <tr>
          <td bgcolor=""#003366"" style=""background-color:#003366;padding:20px 40px;"">
            <p style=""margin:0;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#ffffff;"">Involve Interpreter</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style=""padding:36px 40px;background-color:#ffffff;"">

            <!-- Logo above booking data -->
            {(logoSrc != "" ? $@"<p style=""margin:0 0 20px 0;text-align:center;""><img src=""{logoSrc}"" alt=""Involve Interpreter"" width=""120"" style=""display:inline-block;border:0;height:auto;"" /></p>" : "")}

            <p style=""margin:0 0 8px 0;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#0f172a;"">Hi {recipientName},</p>
            <p style=""margin:0 0 28px 0;font-family:Arial,sans-serif;font-size:14px;color:#475569;line-height:1.6;"">{intro}</p>
            {changesBlock}

            <!-- Details table -->
            <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"">
              <tr>
                <td width=""38%"" bgcolor=""#f8fafc"" style=""padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#64748b;border:1px solid #e2e8f0;"">Booking reference</td>
                <td bgcolor=""#f8fafc"" style=""padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;color:#0f172a;border:1px solid #e2e8f0;border-left:none;"">#{bookingId}</td>
              </tr>
              <tr>
                <td bgcolor=""#ffffff"" style=""padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#64748b;border:1px solid #e2e8f0;border-top:none;"">Date</td>
                <td bgcolor=""#ffffff"" style=""padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;color:#0f172a;border:1px solid #e2e8f0;border-left:none;border-top:none;"">{date}</td>
              </tr>
              <tr>
                <td bgcolor=""#f8fafc"" style=""padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;color:#64748b;border:1px solid #e2e8f0;border-top:none;"">Time</td>
                <td bgcolor=""#f8fafc"" style=""padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;color:#0f172a;border:1px solid #e2e8f0;border-left:none;border-top:none;"">{time}</td>
              </tr>
              {extraRows}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td bgcolor=""#f8fafc"" style=""background-color:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;"">
            <p style=""margin:0;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;"">Involve Interpreter &mdash; bookings@involveinterpreter.com</p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>";
        }

        private async Task<(string? duration, string? bookingType)> ResolveBookingLabelsAsync(Booking booking) =>
            await ResolveLabelsAsync(booking.DurationId, booking.BookingType);

        /// <summary>
        /// Same lookup as ResolveBookingLabelsAsync but against raw ids rather than
        /// a Booking, so a before/after pair of ids (e.g. the duration before and
        /// after an edit) can each be resolved to their display label independently.
        /// </summary>
        private async Task<(string? duration, string? bookingType)> ResolveLabelsAsync(int? durationId, int? bookingTypeId)
        {
            string? duration = null;
            if (durationId.HasValue)
            {
                var dur = await _context.Duration.FindAsync(durationId.Value);
                duration = dur?.Duration;
            }
            string? bookingType = null;
            if (bookingTypeId.HasValue)
            {
                var bt = await _context.BookingType.FindAsync(bookingTypeId.Value);
                bookingType = bt?.BookingType;
            }
            return (duration, bookingType);
        }

        /// <summary>
        /// Field-level diff for the fields that actually matter to someone deciding
        /// whether to attend: date, time, duration, booking type and video link.
        /// Contact details, customer ref and free-text notes are deliberately
        /// excluded — changing them doesn't change what an admin or interpreter
        /// needs to do. Compares formatted display strings rather than raw values,
        /// so a change nobody would actually see (e.g. identical date, different
        /// time-of-day component) never produces a spurious diff row.
        /// </summary>
        // Shared by the field-diff builder and the "did the date/time change"
        // check that decides whether to clear an assigned interpreter — both
        // need the identical definition of "changed", not two comparisons that
        // could quietly drift apart.
        private static string? FormatBookingDate(DateTime? d) => d.HasValue ? d.Value.ToString("dddd, d MMMM yyyy") : null;
        private static string? FormatBookingTime(DateTime? t) => t.HasValue ? t.Value.ToString("HH:mm") : null;

        private async Task<List<(string Field, string? OldValue, string? NewValue)>> BuildChangeSummaryAsync(
            DateTime? oldDate, DateTime? newDate,
            DateTime? oldTime, DateTime? newTime,
            int? oldDurationId, int? newDurationId,
            int? oldBookingTypeId, int? newBookingTypeId,
            string? oldVideoUrl, string? newVideoUrl)
        {
            var changes = new List<(string, string?, string?)>();

            var oldDateStr = FormatBookingDate(oldDate);
            var newDateStr = FormatBookingDate(newDate);
            if (oldDateStr != newDateStr) changes.Add(("Date", oldDateStr, newDateStr));

            var oldTimeStr = FormatBookingTime(oldTime);
            var newTimeStr = FormatBookingTime(newTime);
            if (oldTimeStr != newTimeStr) changes.Add(("Time", oldTimeStr, newTimeStr));

            if (oldDurationId != newDurationId)
            {
                var (oldDur, _) = await ResolveLabelsAsync(oldDurationId, null);
                var (newDur, _) = await ResolveLabelsAsync(newDurationId, null);
                if (oldDur != newDur) changes.Add(("Duration", oldDur, newDur));
            }

            if (oldBookingTypeId != newBookingTypeId)
            {
                var (_, oldType) = await ResolveLabelsAsync(null, oldBookingTypeId);
                var (_, newType) = await ResolveLabelsAsync(null, newBookingTypeId);
                if (oldType != newType) changes.Add(("Booking type", oldType, newType));
            }

            if (!string.Equals(oldVideoUrl, newVideoUrl, StringComparison.Ordinal))
                changes.Add(("Video link", oldVideoUrl, newVideoUrl));

            return changes;
        }

        private void FireBookingNotification(
            Booking booking,
            string customerEmail, string customerName,
            IList<ApplicationUser> admins,
            string customerSubject, string customerIntro,
            string adminSubject, string adminIntro,
            string? duration = null, string? bookingType = null,
            string? companyName = null,
            List<(string Field, string? OldValue, string? NewValue)>? changes = null)
        {
            var date = booking.BookingDate.HasValue
                ? booking.BookingDate.Value.ToString("dddd, d MMMM yyyy")
                : "—";
            var time = booking.BookingTime.HasValue
                ? booking.BookingTime.Value.ToString("HH:mm")
                : "—";
            var id       = booking.BookingId;
            var videoUrl = booking.VideoUrl;
            var contactEmail = booking.ContactEmail;
            var contactName  = booking.ContactName;
            var deafName     = booking.DeafName;
            var profName     = booking.ProfessionalName;
            var profEmail    = booking.ProfessionalEmail;
            var custRef      = booking.CustomerRef;
            var addInfo      = booking.AddInfo;
            var attendees    = booking.Attendees;
            var prepName     = booking.PrepContactName;
            var prepEmail    = booking.PrepContactEmail;

            _ = Task.Run(async () =>
            {
                try
                {
                    var html = BuildBookingEmail(customerName, customerSubject, customerIntro, id, date, time,
                        duration, bookingType, videoUrl, contactEmail,
                        companyName, contactName, deafName, profName, profEmail,
                        custRef, addInfo, attendees, prepName, prepEmail);
                    var ccList = !string.IsNullOrWhiteSpace(profEmail) ? new[] { profEmail } : null;
                    await _emailService.SendAsync(customerEmail, customerSubject, html, ccList);
                }
                catch (Exception ex) { Console.WriteLine($"[Email] Booking customer notification failed: {ex.Message}"); }

                foreach (var admin in admins)
                {
                    if (string.IsNullOrWhiteSpace(admin.Email)) continue;
                    if (!admin.ReceiveBookingNotifications) continue; // this admin opted out
                    try
                    {
                        var adminName = admin.FirstName ?? "Admin";
                        var html = BuildBookingEmail(adminName, adminSubject, adminIntro, id, date, time,
                            duration, bookingType, videoUrl, contactEmail,
                            companyName, contactName, deafName, profName, profEmail,
                            custRef, addInfo, attendees, prepName, prepEmail,
                            changes: changes);
                        await _emailService.SendAsync(admin.Email, adminSubject, html);
                    }
                    catch (Exception ex) { Console.WriteLine($"[Email] Booking admin notification failed: {ex.Message}"); }
                }
            });
        }

        public class DeclineBookingDto
        {
            public string? Reason { get; set; }
            public string? AlternativeTimes { get; set; }
        }

        [HttpPatch("{id}/decline")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeclineBooking(int id, [FromBody] DeclineBookingDto? dto = null)
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

            var declineReason = dto?.Reason?.Trim();
            var altTimes = dto?.AlternativeTimes?.Trim();
            booking.DeclineComments = !string.IsNullOrWhiteSpace(altTimes)
                ? $"{declineReason}: {altTimes}"
                : declineReason;

            await _context.SaveChangesAsync();
            await LogAuditAsync(booking.BookingId, "Declined", "Marked unable to fulfil", booking.DeclineComments, user);

            // Notify SQOD if this booking has an associated appointment
            if (!string.IsNullOrWhiteSpace(booking.SqodAppointmentId))
            {
                _ = _sqodService.CancelAppointmentAsync(booking.SqodAppointmentId, "Booking declined — unable to fulfil");
            }

            // Remove or rename the Outlook/Exchange calendar event
            if (!string.IsNullOrWhiteSpace(booking.OutlookID))
            {
                var hadInterpreterD = !string.IsNullOrWhiteSpace(booking.Interpreter1)
                                   || !string.IsNullOrWhiteSpace(booking.Interpreter2);
                if (!hadInterpreterD)
                {
                    var deleted = await _graphCalendar.DeleteEventAsync(booking.OutlookID, booking.BookingId);
                    if (deleted)
                    {
                        booking.OutlookID = null;
                        await _context.SaveChangesAsync();
                    }
                }
                else
                {
                    var customerUserD = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
                    var (durLabelD, bTypeLabelD) = await ResolveBookingLabelsAsync(booking);
                    var companyD = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;
                    var durMinsD = await GetDurationMinutesAsync(booking);
                    var interpretersD = await GetInterpreterUsersAsync(booking);
                    _ = _graphCalendar.UpdateEventAsync(
                        booking.OutlookID, booking, customerUserD, companyD?.Name, durLabelD, bTypeLabelD, durMinsD, interpretersD,
                        cancelled: true);
                }
            }

            // Email the customer only — no admin notification for declines
            var customerUser = booking.UserId != null ? await _userManager.FindByIdAsync(booking.UserId) : null;
            if (customerUser?.Email != null)
            {
                var custName = customerUser.FirstName ?? customerUser.Email;
                var (dur, bType) = await ResolveBookingLabelsAsync(booking);
                var company = booking.CustId.HasValue ? await _context.Customers.FindAsync(booking.CustId.Value) : null;

                var reasonLine = !string.IsNullOrWhiteSpace(declineReason)
                    ? $" Reason: <strong>{System.Net.WebUtility.HtmlEncode(declineReason)}</strong>."
                    : string.Empty;
                var altLine = !string.IsNullOrWhiteSpace(altTimes)
                    ? $"<br/><br/>We may be able to offer alternative times: <strong>{System.Net.WebUtility.HtmlEncode(altTimes)}</strong>. Please contact us to arrange."
                    : string.Empty;

                FireBookingNotification(booking,
                    customerEmail: customerUser.Email,
                    customerName: custName,
                    admins: new List<ApplicationUser>(),
                    customerSubject: $"Booking #{booking.BookingId} — Unable to fulfil",
                    customerIntro: $"Unfortunately, we were unable to fulfil your booking request.{reasonLine} Please contact us if you have any questions or would like to make an alternative arrangement.{altLine}",
                    adminSubject: "",
                    adminIntro: "",
                    duration: dur, bookingType: bType,
                    companyName: company?.Name);
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

        [HttpGet("billable-report")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> BillableReport([FromQuery] DateTime from, [FromQuery] DateTime to)
        {
            var fromDate    = from.Date;
            var toExclusive = to.Date.AddDays(1);

            const string sql = @"
                SELECT
                  b.BookingId, b.CustId, b.UserId, b.Interpreter1, b.Interpreter2,
                  b.BookingDate, b.BookingTime, b.DurationId, b.BookingType AS BookingTypeId,
                  b.BookingStatus, b.CancelDate, b.NoShow, b.ActualMins, b.DateAdded,
                  b.CustomerRef,
                  c.Name AS CompanyName,
                  u.FirstName AS ReqFirst, u.LastName AS ReqLast,
                  i1.FirstName AS Int1First, i1.LastName AS Int1Last,
                  i2.FirstName AS Int2First, i2.LastName AS Int2Last,
                  d.DurationValue,
                  bt.BookingType AS BookingTypeLabel,
                  s.Status AS StatusLabel
                FROM Booking b
                LEFT JOIN Customer c       ON c.Id = b.CustId
                LEFT JOIN AspNetUsers u    ON u.Id = b.UserId
                LEFT JOIN AspNetUsers i1   ON i1.Id = b.Interpreter1
                LEFT JOIN AspNetUsers i2   ON i2.Id = b.Interpreter2
                LEFT JOIN Duration d       ON d.Id = b.DurationId
                LEFT JOIN BookingType bt   ON bt.Id = b.BookingType
                LEFT JOIN BookingStatus s  ON s.Id = b.BookingStatus
                WHERE b.BookingDate >= @from AND b.BookingDate < @toExclusive
                  AND (
                        s.Status LIKE '%Complete%'
                     OR (s.Status LIKE '%Cancel%'
                         AND (b.Interpreter1 IS NOT NULL OR b.Interpreter2 IS NOT NULL))
                  )
                ORDER BY b.BookingDate DESC, b.BookingTime DESC";

            var results = new List<object>();
            var connectionString = _context.Database.GetConnectionString();
            using var conn = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
            await conn.OpenAsync();
            using var cmd = new Microsoft.Data.SqlClient.SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@from",        fromDate);
            cmd.Parameters.AddWithValue("@toExclusive", toExclusive);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var bookingId     = reader.GetInt32(reader.GetOrdinal("BookingId"));
                var bookingDate   = reader["BookingDate"]   as DateTime?;
                var bookingTime   = reader["BookingTime"]   as DateTime?;
                var cancelDate    = reader["CancelDate"]    as DateTime?;
                var noShow        = reader["NoShow"]        as bool?;
                var actualMins    = reader["ActualMins"]    as int?;
                var durationValue = reader["DurationValue"] as string;
                var statusLabel   = reader["StatusLabel"]   as string;
                var companyName   = reader["CompanyName"]   as string;
                var reqFirst      = reader["ReqFirst"]      as string;
                var reqLast       = reader["ReqLast"]       as string;
                var int1First     = reader["Int1First"]     as string;
                var int1Last      = reader["Int1Last"]      as string;
                var int2First     = reader["Int2First"]     as string;
                var int2Last      = reader["Int2Last"]      as string;
                var btLabel       = reader["BookingTypeLabel"] as string;
                var dateAdded     = reader["DateAdded"]     as DateTime?;
                var customerRef   = reader["CustomerRef"]   as string;

                int? bookedMins = int.TryParse(durationValue, out var bm) ? bm : (int?)null;
                var isComplete  = statusLabel != null && statusLabel.IndexOf("Complete", StringComparison.OrdinalIgnoreCase) >= 0;
                var isCancelled = statusLabel != null && statusLabel.IndexOf("Cancel",   StringComparison.OrdinalIgnoreCase) >= 0;

                // Late-cancel filter: keep only rows cancelled <48h before scheduled start
                // (cancellations made after start time are still billable).
                if (isCancelled)
                {
                    if (!bookingDate.HasValue || !bookingTime.HasValue || !cancelDate.HasValue) continue;
                    var scheduledStart = bookingDate.Value.Date + bookingTime.Value.TimeOfDay;
                    var hoursBefore = (scheduledStart - cancelDate.Value).TotalHours;
                    if (hoursBefore >= 48) continue;
                }

                string outcome;
                if (isComplete && noShow == true) outcome = "No show";
                else if (isComplete)              outcome = "Completed";
                else if (isCancelled)             outcome = "Cancelled (late)";
                else                              outcome = statusLabel ?? "Unknown";

                int? chargedMins = null;
                if (isComplete)
                {
                    if (noShow == true) chargedMins = bookedMins;
                    else if (actualMins.HasValue)
                        chargedMins = bookedMins.HasValue ? Math.Max(actualMins.Value, bookedMins.Value) : actualMins.Value;
                }
                else if (isCancelled)
                {
                    chargedMins = bookedMins;
                }

                string? Compose(string? f, string? l)
                {
                    var name = $"{f} {l}".Trim();
                    return string.IsNullOrWhiteSpace(name) ? null : name;
                }

                results.Add(new
                {
                    bookingId,
                    companyName,
                    customerName  = Compose(reqFirst, reqLast),
                    customerRef,
                    dateRequested = dateAdded,
                    bookingDate,
                    bookingTime,
                    bookingType   = btLabel,
                    outcome,
                    interpreter1  = Compose(int1First,  int1Last),
                    interpreter2  = Compose(int2First,  int2Last),
                    bookedMins,
                    actualMins,
                    chargedMins,
                });
            }

            return Ok(results);
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
