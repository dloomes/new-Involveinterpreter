using SendGrid;
using SendGrid.Helpers.Mail;

public class EmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        var apiKey    = _config["SendGrid:ApiKey"]!;
        var fromEmail = _config["SendGrid:FromEmail"]!;
        var fromName  = _config["SendGrid:FromName"] ?? "BSL Portal";

        var client = new SendGridClient(apiKey);
        var from   = new EmailAddress(fromEmail, fromName);
        var toAddr = new EmailAddress(to);
        var msg    = MailHelper.CreateSingleEmail(from, toAddr, subject, null, htmlBody);

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
