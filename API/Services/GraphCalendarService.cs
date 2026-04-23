using Azure.Identity;
using IIAPI.Models;
using Microsoft.Graph;
using Microsoft.Graph.Models;

public class GraphCalendarService
{
    private readonly IConfiguration _config;
    private readonly GraphServiceClient? _graph;
    private readonly string? _mailbox;
    private readonly string _timeZone;

    public GraphCalendarService(IConfiguration config)
    {
        _config = config;

        var tenantId     = _config["Graph:TenantId"];
        var clientId     = _config["Graph:ClientId"];
        var clientSecret = _config["Graph:ClientSecret"];
        _mailbox         = _config["Graph:CalendarMailbox"];
        _timeZone        = _config["Graph:EventTimeZone"] ?? "GMT Standard Time";

        if (string.IsNullOrWhiteSpace(tenantId) ||
            string.IsNullOrWhiteSpace(clientId) ||
            string.IsNullOrWhiteSpace(clientSecret) ||
            string.IsNullOrWhiteSpace(_mailbox))
        {
            Console.WriteLine("[Graph] Not configured — calendar sync disabled.");
            return;
        }

        var credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        _graph = new GraphServiceClient(credential, new[] { "https://graph.microsoft.com/.default" });
        Console.WriteLine($"[Graph] Configured — calendar sync enabled for {_mailbox}");
    }

    private bool IsReady => _graph != null && !string.IsNullOrWhiteSpace(_mailbox);

    private static string BuildSubject(Booking booking, ApplicationUser? customer, string? companyName, List<ApplicationUser> interpreters, bool cancelled)
    {
        var prefix = cancelled ? "Cancelled: " : "";
        var custName = customer != null ? $"{customer.FirstName} {customer.LastName}".Trim() : null;
        var who = !string.IsNullOrWhiteSpace(companyName) ? companyName : custName ?? "Booking";
        var interpSuffix = interpreters.Count > 0
            ? " — " + string.Join(" & ", interpreters.Select(i => $"{i.FirstName} {i.LastName}".Trim()))
            : "";
        return $"{prefix}#{booking.BookingId} {who}{interpSuffix}";
    }

    private static string BuildBody(
        Booking booking, ApplicationUser? customer, string? companyName,
        string? durationLabel, string? bookingTypeLabel, List<ApplicationUser> interpreters)
    {
        var lines = new List<string>
        {
            $"<p><strong>Booking #{booking.BookingId}</strong></p>",
            "<ul>"
        };

        if (!string.IsNullOrWhiteSpace(companyName))
            lines.Add($"<li><strong>Company:</strong> {System.Net.WebUtility.HtmlEncode(companyName)}</li>");
        if (customer != null)
            lines.Add($"<li><strong>Requestor:</strong> {System.Net.WebUtility.HtmlEncode($"{customer.FirstName} {customer.LastName}".Trim())}</li>");
        if (!string.IsNullOrWhiteSpace(bookingTypeLabel))
            lines.Add($"<li><strong>Type:</strong> {System.Net.WebUtility.HtmlEncode(bookingTypeLabel)}</li>");
        if (!string.IsNullOrWhiteSpace(durationLabel))
            lines.Add($"<li><strong>Duration:</strong> {System.Net.WebUtility.HtmlEncode(durationLabel)}</li>");
        if (!string.IsNullOrWhiteSpace(booking.DeafName))
            lines.Add($"<li><strong>Deaf attendee:</strong> {System.Net.WebUtility.HtmlEncode(booking.DeafName)}</li>");
        if (!string.IsNullOrWhiteSpace(booking.ProfessionalName))
            lines.Add($"<li><strong>Professional:</strong> {System.Net.WebUtility.HtmlEncode(booking.ProfessionalName)}</li>");
        if (!string.IsNullOrWhiteSpace(booking.ContactName))
            lines.Add($"<li><strong>Contact:</strong> {System.Net.WebUtility.HtmlEncode(booking.ContactName)}</li>");
        if (!string.IsNullOrWhiteSpace(booking.ContactEmail))
            lines.Add($"<li><strong>Contact email:</strong> {System.Net.WebUtility.HtmlEncode(booking.ContactEmail)}</li>");
        if (!string.IsNullOrWhiteSpace(booking.ContactNumber))
            lines.Add($"<li><strong>Contact number:</strong> {System.Net.WebUtility.HtmlEncode(booking.ContactNumber)}</li>");
        if (!string.IsNullOrWhiteSpace(booking.CustomerRef))
            lines.Add($"<li><strong>Customer ref:</strong> {System.Net.WebUtility.HtmlEncode(booking.CustomerRef)}</li>");
        if (!string.IsNullOrWhiteSpace(booking.VideoUrl))
            lines.Add($"<li><strong>Video link:</strong> <a href=\"{System.Net.WebUtility.HtmlEncode(booking.VideoUrl)}\">{System.Net.WebUtility.HtmlEncode(booking.VideoUrl)}</a></li>");
        if (interpreters.Count > 0)
        {
            var names = string.Join(", ", interpreters.Select(i => $"{i.FirstName} {i.LastName}".Trim()));
            lines.Add($"<li><strong>Interpreter(s):</strong> {System.Net.WebUtility.HtmlEncode(names)}</li>");
        }

        lines.Add("</ul>");

        if (!string.IsNullOrWhiteSpace(booking.AddInfo))
            lines.Add($"<p><strong>Additional info:</strong><br/>{System.Net.WebUtility.HtmlEncode(booking.AddInfo).Replace("\n", "<br/>")}</p>");

        return string.Concat(lines);
    }

    private static (DateTime start, DateTime end) ResolveWindow(Booking booking, int? durationMinutes)
    {
        var start = booking.BookingTime ?? booking.BookingDate ?? DateTime.UtcNow;
        var end   = start.AddMinutes(durationMinutes ?? 60);
        return (start, end);
    }

    private List<Attendee> BuildAttendees(List<ApplicationUser> interpreters)
    {
        return interpreters
            .Where(i => !string.IsNullOrWhiteSpace(i.Email))
            .Select(i => new Attendee
            {
                EmailAddress = new EmailAddress
                {
                    Address = i.Email!,
                    Name    = $"{i.FirstName} {i.LastName}".Trim(),
                },
                Type = AttendeeType.Required,
            })
            .ToList();
    }

    /// <summary>
    /// Creates a calendar event in the shared bookings mailbox.
    /// Returns the Graph event ID or null on failure.
    /// </summary>
    public async Task<string?> CreateEventAsync(
        Booking booking,
        ApplicationUser? customer,
        string? companyName,
        string? durationLabel,
        string? bookingTypeLabel,
        int? durationMinutes,
        List<ApplicationUser> interpreters)
    {
        Console.WriteLine($"[Graph] CreateEventAsync called for booking #{booking.BookingId} (ready={IsReady})");
        if (!IsReady) return null;

        try
        {
            var (start, end) = ResolveWindow(booking, durationMinutes);

            var evt = new Event
            {
                Subject = BuildSubject(booking, customer, companyName, interpreters, cancelled: false),
                Body = new ItemBody
                {
                    ContentType = BodyType.Html,
                    Content = BuildBody(booking, customer, companyName, durationLabel, bookingTypeLabel, interpreters),
                },
                Start = new DateTimeTimeZone
                {
                    DateTime = start.ToString("yyyy-MM-ddTHH:mm:ss"),
                    TimeZone = _timeZone,
                },
                End = new DateTimeTimeZone
                {
                    DateTime = end.ToString("yyyy-MM-ddTHH:mm:ss"),
                    TimeZone = _timeZone,
                },
                Attendees = BuildAttendees(interpreters),
                Location = string.IsNullOrWhiteSpace(booking.VideoUrl) ? null : new Location { DisplayName = "Video call" },
                IsOnlineMeeting = false,
            };

            var created = await _graph!.Users[_mailbox].Events.PostAsync(evt);
            Console.WriteLine($"[Graph] Event created for booking #{booking.BookingId}: {created?.Id}");
            return created?.Id;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Graph] CreateEventAsync failed for booking #{booking.BookingId}: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Updates an existing calendar event (subject, body, window, attendees).
    /// </summary>
    public async Task<bool> UpdateEventAsync(
        string eventId,
        Booking booking,
        ApplicationUser? customer,
        string? companyName,
        string? durationLabel,
        string? bookingTypeLabel,
        int? durationMinutes,
        List<ApplicationUser> interpreters,
        bool cancelled = false)
    {
        if (!IsReady || string.IsNullOrWhiteSpace(eventId)) return false;

        try
        {
            var (start, end) = ResolveWindow(booking, durationMinutes);

            var patch = new Event
            {
                Subject = BuildSubject(booking, customer, companyName, interpreters, cancelled),
                Body = new ItemBody
                {
                    ContentType = BodyType.Html,
                    Content = BuildBody(booking, customer, companyName, durationLabel, bookingTypeLabel, interpreters),
                },
                Start = new DateTimeTimeZone
                {
                    DateTime = start.ToString("yyyy-MM-ddTHH:mm:ss"),
                    TimeZone = _timeZone,
                },
                End = new DateTimeTimeZone
                {
                    DateTime = end.ToString("yyyy-MM-ddTHH:mm:ss"),
                    TimeZone = _timeZone,
                },
                Attendees = BuildAttendees(interpreters),
            };

            await _graph!.Users[_mailbox].Events[eventId].PatchAsync(patch);
            Console.WriteLine($"[Graph] Event {eventId} updated for booking #{booking.BookingId}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Graph] UpdateEventAsync failed for booking #{booking.BookingId}: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Deletes a calendar event.
    /// </summary>
    public async Task<bool> DeleteEventAsync(string eventId, int bookingId)
    {
        if (!IsReady || string.IsNullOrWhiteSpace(eventId)) return false;

        try
        {
            await _graph!.Users[_mailbox].Events[eventId].DeleteAsync();
            Console.WriteLine($"[Graph] Event {eventId} deleted for booking #{bookingId}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Graph] DeleteEventAsync failed for booking #{bookingId}: {ex.Message}");
            return false;
        }
    }
}
