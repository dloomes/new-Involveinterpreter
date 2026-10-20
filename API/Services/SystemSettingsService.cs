using Microsoft.Data.SqlClient;

/// <summary>
/// System-wide settings controlled by Admin/Super Admin users. Backed by a
/// single-row table rather than an EF entity — this repo manages its schema
/// by hand rather than through EF migrations (see dbo.SystemSettings), and a
/// dedicated table for exactly one flag is simpler than a generic key/value
/// store nothing else needs yet.
/// </summary>
public class SystemSettingsService
{
    private readonly IConfiguration _config;

    public SystemSettingsService(IConfiguration config)
    {
        _config = config;
    }

    private string ConnectionString => _config.GetConnectionString("DefaultConnection")!;

    /// <summary>
    /// Whether booking notification emails (created/updated/cancelled/assigned/
    /// declined, to customers, admins and interpreters) should be sent. Does not
    /// affect account activation or password-reset emails — those go through a
    /// separate call path and are left alone regardless of this setting.
    /// </summary>
    public async Task<bool> AreEmailNotificationsEnabledAsync()
    {
        try
        {
            using var conn = new SqlConnection(ConnectionString);
            await conn.OpenAsync();
            using var cmd = new SqlCommand(
                "SELECT EmailNotificationsEnabled FROM dbo.SystemSettings WHERE Id = 1", conn);
            var result = await cmd.ExecuteScalarAsync();

            // Fail open: a missing row or a transient DB error should not become
            // a silent, unexplained outage of real booking emails. The worse
            // failure mode here is "nobody told the customer", not "one extra email".
            return result == null || result == DBNull.Value || (bool)result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SystemSettings] Could not read EmailNotificationsEnabled ({ex.Message}) — defaulting to enabled.");
            return true;
        }
    }

    public async Task SetEmailNotificationsEnabledAsync(bool enabled, string? updatedByUserId)
    {
        using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        using var cmd = new SqlCommand(@"
            UPDATE dbo.SystemSettings
            SET EmailNotificationsEnabled = @enabled, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
            WHERE Id = 1", conn);
        cmd.Parameters.AddWithValue("@enabled", enabled);
        cmd.Parameters.AddWithValue("@updatedBy", (object?)updatedByUserId ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }
}
