using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Net.Http;
using IIAPI.Models;

public class SqodService
{
    private readonly IConfiguration _config;
    private static readonly HttpClient _http = new();

    // Cached token — shared across all scoped instances (static fields on the class)
    private static string? _cachedToken;
    private static DateTime _tokenExpiry = DateTime.MinValue;
    private static readonly SemaphoreSlim _tokenLock = new(1, 1);

    public SqodService(IConfiguration config)
    {
        _config = config;
    }

    private async Task<string?> GetTokenAsync()
    {
        // Return cached token if still valid (with 60-second buffer)
        if (_cachedToken != null && DateTime.UtcNow < _tokenExpiry.AddSeconds(-60))
            return _cachedToken;

        await _tokenLock.WaitAsync();
        try
        {
            // Double-check inside lock
            if (_cachedToken != null && DateTime.UtcNow < _tokenExpiry.AddSeconds(-60))
                return _cachedToken;

            var clientId     = _config["Sqod:ClientId"];
            var clientSecret = _config["Sqod:ClientSecret"];

            if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
            {
                Console.WriteLine("[Sqod] ClientId or ClientSecret not configured.");
                return null;
            }

            var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
            var url = $"https://auth.app.sqod.co.uk/oauth2/token?clientid={Uri.EscapeDataString(clientId)}";

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
            request.Content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("grant_type", "client_credentials"),
            });

            HttpResponseMessage response;
            try
            {
                response = await _http.SendAsync(request);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Sqod] Token request failed: {ex.Message}");
                return null;
            }

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[Sqod] Token request returned {(int)response.StatusCode}");
                return null;
            }

            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
            if (!doc.RootElement.TryGetProperty("access_token", out var tokenEl))
            {
                Console.WriteLine("[Sqod] access_token not found in token response.");
                return null;
            }

            var expiresIn = doc.RootElement.TryGetProperty("expires_in", out var expiresEl)
                ? expiresEl.GetInt32()
                : 3600;

            _cachedToken = tokenEl.GetString();
            _tokenExpiry = DateTime.UtcNow.AddSeconds(expiresIn);
            Console.WriteLine($"[Sqod] Token acquired, expires in {expiresIn}s");
            return _cachedToken;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    public record SqodAppointmentResult(string AppointmentId, string CustomerUrl, string? RoomUrl);

    /// <summary>
    /// Normalises a phone number to E.164 format (+[country][number]).
    /// Assumes UK (+44) when no country code is present.
    /// Returns null if the input is empty or unrecognisable.
    /// </summary>
    private static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;

        // Keep only digits, but remember if a leading + was present
        bool hasPlus = phone.TrimStart().StartsWith("+");
        var digits = new string(phone.Where(char.IsDigit).ToArray());

        if (string.IsNullOrEmpty(digits)) return null;

        if (hasPlus)
            return "+" + digits;           // already has country code

        if (digits.StartsWith("44"))
            return "+" + digits;           // 44... without the +

        if (digits.StartsWith("0"))
            return "+44" + digits[1..];    // UK local: 07... → +447...

        return null; // unrecognisable — omit rather than send bad data
    }

    /// <summary>
    /// Creates a SQOD appointment and returns the customer URL and agent room URL,
    /// or null if not configured / the call fails.
    /// </summary>
    public async Task<SqodAppointmentResult?> CreateAppointmentAsync(
        Booking booking,
        ApplicationUser customer,
        int? durationMinutes)
    {
        var baseUrl = _config["Sqod:BaseUrl"]?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            Console.WriteLine("[Sqod] SKIPPED — BaseUrl is not configured in appsettings.");
            return null;
        }

        Console.WriteLine($"[Sqod] Creating appointment for booking #{booking.BookingId} via {baseUrl}");

        var token = await GetTokenAsync();
        if (token == null)
        {
            Console.WriteLine("[Sqod] SKIPPED — could not obtain bearer token.");
            return null;
        }

        // BookingTime holds the full datetime (date + time combined)
        var appointmentAt = booking.BookingTime ?? booking.BookingDate ?? DateTime.UtcNow;
        var custName  = $"{customer.FirstName} {customer.LastName}".Trim();
        var custEmail = booking.ContactEmail ?? customer.Email ?? "";
        var custPhone = NormalizePhone(booking.ContactNumber ?? customer.PhoneNumber);
        var aptAt     = appointmentAt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.ffffff");
        var duration  = (durationMinutes ?? 60).ToString();

        Console.WriteLine($"[Sqod] Payload: appointment_at={aptAt}, duration={duration}m, claimant={custName} <{custEmail}>, phone={custPhone ?? "omitted"}");

        var formFields = new List<KeyValuePair<string, string>>
        {
            new("appointment_at",      aptAt),
            new("duration_in_minutes", duration),
            new("reference",           booking.BookingId.ToString()),
            new("claimant[name]",      custName),
            new("claimant[email]",     custEmail),
        };

        if (custPhone != null)
            formFields.Add(new("claimant[phone_number]", custPhone));

        var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/api/v1/appointments");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Content = new FormUrlEncodedContent(formFields);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Sqod] HTTP request threw: {ex.Message}");
            return null;
        }

        var responseBody = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"[Sqod] Response {(int)response.StatusCode}: {responseBody}");

        if (!response.IsSuccessStatusCode)
            return null;

        using var doc = JsonDocument.Parse(responseBody);
        if (!doc.RootElement.TryGetProperty("data", out var data) ||
            !data.TryGetProperty("url", out var urlEl))
        {
            Console.WriteLine("[Sqod] WARNING — response was 2xx but 'data.url' field not found.");
            return null;
        }

        var customerUrl = urlEl.GetString()!;

        string? appointmentId = null;
        if (data.TryGetProperty("id", out var idEl))
            appointmentId = idEl.GetString();

        string? roomUrl = null;
        if (data.TryGetProperty("meeting", out var meeting) &&
            meeting.ValueKind == JsonValueKind.Object &&
            meeting.TryGetProperty("room_url", out var roomUrlEl))
        {
            roomUrl = roomUrlEl.GetString();
        }

        Console.WriteLine($"[Sqod] Appointment ID: {appointmentId ?? "unknown"}");
        Console.WriteLine($"[Sqod] Customer URL: {customerUrl}");
        Console.WriteLine($"[Sqod] Room URL: {roomUrl ?? "none"}");
        return new SqodAppointmentResult(appointmentId ?? "", customerUrl, roomUrl);
    }

    /// <summary>
    /// Updates a SQOD appointment with the latest booking details.
    /// </summary>
    public async Task<bool> UpdateAppointmentAsync(
        string sqodAppointmentId,
        Booking booking,
        ApplicationUser customer,
        int? durationMinutes)
    {
        var baseUrl = _config["Sqod:BaseUrl"]?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(sqodAppointmentId))
        {
            Console.WriteLine("[Sqod] UpdateAppointment SKIPPED — BaseUrl or appointment ID missing.");
            return false;
        }

        Console.WriteLine($"[Sqod] Updating appointment {sqodAppointmentId} for booking #{booking.BookingId}");

        var token = await GetTokenAsync();
        if (token == null)
        {
            Console.WriteLine("[Sqod] UpdateAppointment SKIPPED — could not obtain bearer token.");
            return false;
        }

        var appointmentAt = booking.BookingTime ?? booking.BookingDate ?? DateTime.UtcNow;
        var custName  = $"{customer.FirstName} {customer.LastName}".Trim();
        var custEmail = booking.ContactEmail ?? customer.Email ?? "";
        var custPhone = NormalizePhone(booking.ContactNumber ?? customer.PhoneNumber);

        var payload = new Dictionary<string, object?>
        {
            ["appointment_at"]      = appointmentAt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.ffffff"),
            ["duration_in_minutes"] = durationMinutes ?? 60,
            ["claimant"] = new Dictionary<string, string?> {
                ["name"]         = custName,
                ["email"]        = custEmail,
                ["phone_number"] = custPhone,
            },
        };

        var request = new HttpRequestMessage(HttpMethod.Patch,
            $"{baseUrl}/api/v1/appointments/{Uri.EscapeDataString(sqodAppointmentId)}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Content = JsonContent.Create(payload);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Sqod] Update request threw: {ex.Message}");
            return false;
        }

        var body = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"[Sqod] Update response {(int)response.StatusCode}: {body}");
        return response.IsSuccessStatusCode;
    }

    /// <summary>
    /// Cancels a SQOD appointment by its UUID.
    /// </summary>
    public async Task<bool> CancelAppointmentAsync(string sqodAppointmentId, string reason = "Booking cancelled")
    {
        var baseUrl = _config["Sqod:BaseUrl"]?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(sqodAppointmentId))
        {
            Console.WriteLine("[Sqod] CancelAppointment SKIPPED — BaseUrl or appointment ID missing.");
            return false;
        }

        Console.WriteLine($"[Sqod] Cancelling appointment {sqodAppointmentId}");

        var token = await GetTokenAsync();
        if (token == null)
        {
            Console.WriteLine("[Sqod] CancelAppointment SKIPPED — could not obtain bearer token.");
            return false;
        }

        var request = new HttpRequestMessage(HttpMethod.Post,
            $"{baseUrl}/api/v1/appointments/{Uri.EscapeDataString(sqodAppointmentId)}/cancel");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("cancellation_reason", reason),
        });

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Sqod] Cancel request threw: {ex.Message}");
            return false;
        }

        var body = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"[Sqod] Cancel response {(int)response.StatusCode}: {body}");
        return response.IsSuccessStatusCode;
    }
}
