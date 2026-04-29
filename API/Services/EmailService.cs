using SendGrid;
using SendGrid.Helpers.Mail;

public class EmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendAsync(string to, string subject, string htmlBody, IEnumerable<string>? cc = null)
    {
        var apiKey    = _config["SendGrid:ApiKey"]!;
        var fromEmail = _config["SendGrid:FromEmail"]!;
        var fromName  = _config["SendGrid:FromName"] ?? "BSL Portal";

        var client = new SendGridClient(apiKey);
        var from   = new EmailAddress(fromEmail, fromName);
        var toAddr = new EmailAddress(to);
        var msg    = MailHelper.CreateSingleEmail(from, toAddr, subject, null, htmlBody);

        if (cc != null)
        {
            var ccList = cc
                .Where(e => !string.IsNullOrWhiteSpace(e)
                            && !string.Equals(e, to, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(e => new EmailAddress(e))
                .ToList();
            if (ccList.Count > 0) msg.AddCcs(ccList);
        }

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        var response = await client.SendEmailAsync(msg, cts.Token);

        Console.WriteLine($"[SendGrid] Status: {(int)response.StatusCode}");

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Body.ReadAsStringAsync();
            Console.WriteLine($"[SendGrid] Error body: {body}");
            throw new Exception($"SendGrid {(int)response.StatusCode}: {body}");
        }
    }
}
