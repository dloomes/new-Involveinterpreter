// Services/BookingService.cs
using System.Data;
using Microsoft.Data.SqlClient;
using IIAPI.Models;
using IIAPI.Models.DTOs;

public class BookingService
{
    private readonly IConfiguration _config;

    public BookingService(IConfiguration config)
    {
        _config = config;
    }

    public async Task<List<BookingDto>> GetBookingsByUserAsync(string userId)
    {
        var bookings = new List<BookingDto>();
        var connectionString = _config.GetConnectionString("DefaultConnection");

        using (var connection = new SqlConnection(connectionString))
        {
            using (var command = new SqlCommand("GetBookingsforUser", connection))
            {
                command.CommandType = CommandType.StoredProcedure;
                command.Parameters.AddWithValue("@id", userId);

                await connection.OpenAsync();
                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        bookings.Add(new BookingDto
                        {
                            id = reader.GetInt32(reader.GetOrdinal("BookingId")),
                            BookingDate = reader.GetDateTime(reader.GetOrdinal("BookingDate")),
                            BookingTime = reader.GetDateTime(reader.GetOrdinal("BookingTime")),
                            ContactEmail  = reader.IsDBNull(reader.GetOrdinal("ContactEmail"))   ? null : reader.GetString(reader.GetOrdinal("ContactEmail")),
                            ContactNumber = reader.IsDBNull(reader.GetOrdinal("ContactNumber"))  ? null : reader.GetString(reader.GetOrdinal("ContactNumber")),
                            AddInfo       = reader.IsDBNull(reader.GetOrdinal("AddInfo"))        ? null : reader.GetString(reader.GetOrdinal("AddInfo")),
                            Duration      = reader.IsDBNull(reader.GetOrdinal("Duration"))       ? null : reader.GetString(reader.GetOrdinal("Duration")),
                            Status        = reader.IsDBNull(reader.GetOrdinal("Booking Status")) ? null : reader.GetString(reader.GetOrdinal("Booking Status")),
                            VideoUrl      = reader.IsDBNull(reader.GetOrdinal("VideoUrl"))       ? null : reader.GetString(reader.GetOrdinal("VideoUrl")),
                        });
                    }
                }
            }
        }

        return bookings;
    }
    public async Task<List<BookingDto>> GetPendingBookingsByUserAsync(string userId)
    {
        var bookings = new List<BookingDto>();
        var connectionString = _config.GetConnectionString("DefaultConnection");

        using (var connection = new SqlConnection(connectionString))
        {
            using (var command = new SqlCommand("GetPendingBookingsforUser", connection))
            {
                command.CommandType = CommandType.StoredProcedure;
                command.Parameters.AddWithValue("@id", userId);

                await connection.OpenAsync();
                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        bookings.Add(new BookingDto
                        {
                            id = reader.GetInt32(reader.GetOrdinal("BookingId")),
                            BookingDate = reader.GetDateTime(reader.GetOrdinal("BookingDate")),
                            BookingTime = reader.GetDateTime(reader.GetOrdinal("BookingTime")),
                            ContactEmail  = reader.IsDBNull(reader.GetOrdinal("ContactEmail"))  ? null : reader.GetString(reader.GetOrdinal("ContactEmail")),
                            ContactNumber = reader.IsDBNull(reader.GetOrdinal("ContactNumber")) ? null : reader.GetString(reader.GetOrdinal("ContactNumber")),
                            AddInfo       = reader.IsDBNull(reader.GetOrdinal("AddInfo"))       ? null : reader.GetString(reader.GetOrdinal("AddInfo")),
                            Duration      = reader.IsDBNull(reader.GetOrdinal("Duration"))      ? null : reader.GetString(reader.GetOrdinal("Duration")),
                            Status        = reader.IsDBNull(reader.GetOrdinal("Status"))        ? null : reader.GetString(reader.GetOrdinal("Status")),
                            VideoUrl      = reader.IsDBNull(reader.GetOrdinal("VideoUrl"))      ? null : reader.GetString(reader.GetOrdinal("VideoUrl")),
                            RequestedBy   = reader.IsDBNull(reader.GetOrdinal("Requested By")) ? null : reader.GetString(reader.GetOrdinal("Requested By")),
                        });
                    }
                }
            }
        }

        return bookings;
    }
    public async Task<List<BookingDto>> GetFutureBookingsByUserAsync(string userId)
    {
        var bookings = new List<BookingDto>();
        var connectionString = _config.GetConnectionString("DefaultConnection");

        using (var connection = new SqlConnection(connectionString))
        {
            using (var command = new SqlCommand("GetFutureBookingsforUser", connection))
            {
                command.CommandType = CommandType.StoredProcedure;
                command.Parameters.AddWithValue("@id", userId);

                await connection.OpenAsync();
                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        bookings.Add(new BookingDto
                        {
                            id = reader.GetInt32(reader.GetOrdinal("BookingId")),
                            BookingDate = reader.GetDateTime(reader.GetOrdinal("BookingDate")),
                            BookingTime = reader.GetDateTime(reader.GetOrdinal("BookingTime")),
                            ContactEmail  = reader.IsDBNull(reader.GetOrdinal("ContactEmail"))  ? null : reader.GetString(reader.GetOrdinal("ContactEmail")),
                            ContactNumber = reader.IsDBNull(reader.GetOrdinal("ContactNumber")) ? null : reader.GetString(reader.GetOrdinal("ContactNumber")),
                            AddInfo       = reader.IsDBNull(reader.GetOrdinal("AddInfo"))       ? null : reader.GetString(reader.GetOrdinal("AddInfo")),
                            Duration      = reader.IsDBNull(reader.GetOrdinal("Duration"))      ? null : reader.GetString(reader.GetOrdinal("Duration")),
                            Status        = reader.IsDBNull(reader.GetOrdinal("Status"))        ? null : reader.GetString(reader.GetOrdinal("Status")),
                            VideoUrl      = reader.IsDBNull(reader.GetOrdinal("VideoUrl"))      ? null : reader.GetString(reader.GetOrdinal("VideoUrl")),
                            RequestedBy   = reader.IsDBNull(reader.GetOrdinal("Requested By")) ? null : reader.GetString(reader.GetOrdinal("Requested By")),
                        });
                    }
                }
            }
        }

        return bookings;
    }
    public async Task<List<BookingDto>> GetCancelledBookingsByUserAsync(string userId)
    {
        var bookings = new List<BookingDto>();
        var connectionString = _config.GetConnectionString("DefaultConnection");

        using (var connection = new SqlConnection(connectionString))
        {
            using (var command = new SqlCommand("GetCancelledBookingsforUser", connection))
            {
                command.CommandType = CommandType.StoredProcedure;
                command.Parameters.AddWithValue("@id", userId);

                await connection.OpenAsync();
                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        bookings.Add(new BookingDto
                        {
                            id = reader.GetInt32(reader.GetOrdinal("BookingId")),
                            BookingDate = reader.GetDateTime(reader.GetOrdinal("BookingDate")),
                            BookingTime = reader.GetDateTime(reader.GetOrdinal("BookingTime")),
                            ContactEmail  = reader.IsDBNull(reader.GetOrdinal("ContactEmail"))  ? null : reader.GetString(reader.GetOrdinal("ContactEmail")),
                            ContactNumber = reader.IsDBNull(reader.GetOrdinal("ContactNumber")) ? null : reader.GetString(reader.GetOrdinal("ContactNumber")),
                            AddInfo       = reader.IsDBNull(reader.GetOrdinal("AddInfo"))       ? null : reader.GetString(reader.GetOrdinal("AddInfo")),
                            Duration      = reader.IsDBNull(reader.GetOrdinal("Duration"))      ? null : reader.GetString(reader.GetOrdinal("Duration")),
                            Status        = reader.IsDBNull(reader.GetOrdinal("Status"))        ? null : reader.GetString(reader.GetOrdinal("Status")),
                            VideoUrl      = reader.IsDBNull(reader.GetOrdinal("VideoUrl"))      ? null : reader.GetString(reader.GetOrdinal("VideoUrl")),
                            RequestedBy   = reader.IsDBNull(reader.GetOrdinal("Requested By")) ? null : reader.GetString(reader.GetOrdinal("Requested By")),
                        });
                    }
                }
            }
        }

        return bookings;
    }

    public async Task<List<CalendarViewDto>> GetCalendarViewAsync(string userId)
    {
        var events = new List<CalendarViewDto>();
        var connectionString = _config.GetConnectionString("DefaultConnection");

        using (var connection = new SqlConnection(connectionString))
        {
            using (var command = new SqlCommand("SPGetCustCalendarView", connection))
            {
                command.CommandType = CommandType.StoredProcedure;
                command.Parameters.AddWithValue("@id", userId);

                await connection.OpenAsync();
                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        events.Add(new CalendarViewDto
                        {
                            BookingId     = reader.GetInt32(reader.GetOrdinal("BookingId")),
                            FullName      = reader.IsDBNull(reader.GetOrdinal("FullName"))      ? null : reader.GetString(reader.GetOrdinal("FullName")),
                            StartTime     = reader.IsDBNull(reader.GetOrdinal("Starttime"))     ? null : reader.GetDateTime(reader.GetOrdinal("Starttime")),
                            EndTime       = reader.IsDBNull(reader.GetOrdinal("EndTime"))       ? null : reader.GetDateTime(reader.GetOrdinal("EndTime")),
                            Customer      = reader.IsDBNull(reader.GetOrdinal("Customer"))      ? null : reader.GetString(reader.GetOrdinal("Customer")),
                            Duration      = reader.IsDBNull(reader.GetOrdinal("Duration"))      ? null : reader.GetString(reader.GetOrdinal("Duration")),
                            Language      = reader.IsDBNull(reader.GetOrdinal("Language"))      ? null : reader.GetString(reader.GetOrdinal("Language")),
                            Status        = reader.IsDBNull(reader.GetOrdinal("Status"))        ? null : reader.GetString(reader.GetOrdinal("Status")),
                            Int1          = reader.IsDBNull(reader.GetOrdinal("Int 1"))         ? null : reader.GetString(reader.GetOrdinal("Int 1")),
                            Int2          = reader.IsDBNull(reader.GetOrdinal("Int 2"))         ? null : reader.GetString(reader.GetOrdinal("Int 2")),
                            BookingStatus = reader.IsDBNull(reader.GetOrdinal("BookingStatus")) ? null : reader.GetInt32(reader.GetOrdinal("BookingStatus"))
                        });
                    }
                }
            }
        }

        return events;
    }
    public async Task<List<CalendarViewDto>> GetInterpreterCalendarViewAsync(string interpreterId)
    {
        var events = new List<CalendarViewDto>();
        var connectionString = _config.GetConnectionString("DefaultConnection");

        const string sql = @"
            SELECT
                b.BookingId,
                LTRIM(RTRIM(CONCAT(u.FirstName, ' ', u.LastName))) AS FullName,
                b.BookingTime AS Starttime,
                DATEADD(MINUTE, TRY_CAST(d.DurationValue AS INT), b.BookingTime) AS EndTime,
                c.Name AS Customer,
                d.Duration AS Duration,
                NULL AS Language,
                s.Status AS Status,
                LTRIM(RTRIM(CONCAT(i1.FirstName, ' ', i1.LastName))) AS [Int 1],
                LTRIM(RTRIM(CONCAT(i2.FirstName, ' ', i2.LastName))) AS [Int 2],
                b.BookingStatus AS BookingStatus
            FROM Booking b
            LEFT JOIN AspNetUsers u  ON u.Id  = b.UserId
            LEFT JOIN Customer c     ON c.Id  = b.CustId
            LEFT JOIN Duration d     ON d.Id  = b.DurationId
            LEFT JOIN BookingStatus s ON s.Id = b.BookingStatus
            LEFT JOIN AspNetUsers i1 ON i1.Id = b.Interpreter1
            LEFT JOIN AspNetUsers i2 ON i2.Id = b.Interpreter2
            WHERE b.Interpreter1 = @interpreterId OR b.Interpreter2 = @interpreterId
            ORDER BY b.BookingTime DESC";

        using (var connection = new SqlConnection(connectionString))
        using (var command = new SqlCommand(sql, connection))
        {
            command.Parameters.AddWithValue("@interpreterId", interpreterId);
            await connection.OpenAsync();
            using (var reader = await command.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    events.Add(new CalendarViewDto
                    {
                        BookingId     = reader.GetInt32(reader.GetOrdinal("BookingId")),
                        FullName      = reader.IsDBNull(reader.GetOrdinal("FullName"))      ? null : reader.GetString(reader.GetOrdinal("FullName")),
                        StartTime     = reader.IsDBNull(reader.GetOrdinal("Starttime"))     ? null : reader.GetDateTime(reader.GetOrdinal("Starttime")),
                        EndTime       = reader.IsDBNull(reader.GetOrdinal("EndTime"))       ? null : reader.GetDateTime(reader.GetOrdinal("EndTime")),
                        Customer      = reader.IsDBNull(reader.GetOrdinal("Customer"))      ? null : reader.GetString(reader.GetOrdinal("Customer")),
                        Duration      = reader.IsDBNull(reader.GetOrdinal("Duration"))      ? null : reader.GetString(reader.GetOrdinal("Duration")),
                        Language      = reader.IsDBNull(reader.GetOrdinal("Language"))      ? null : reader.GetString(reader.GetOrdinal("Language")),
                        Status        = reader.IsDBNull(reader.GetOrdinal("Status"))        ? null : reader.GetString(reader.GetOrdinal("Status")),
                        Int1          = reader.IsDBNull(reader.GetOrdinal("Int 1"))         ? null : reader.GetString(reader.GetOrdinal("Int 1")),
                        Int2          = reader.IsDBNull(reader.GetOrdinal("Int 2"))         ? null : reader.GetString(reader.GetOrdinal("Int 2")),
                        BookingStatus = reader.IsDBNull(reader.GetOrdinal("BookingStatus")) ? null : reader.GetInt32(reader.GetOrdinal("BookingStatus"))
                    });
                }
            }
        }

        return events;
    }

    public async Task<List<CalendarViewDto>> GetAdminCalendarViewAsync()
    {
        var events = new List<CalendarViewDto>();
        var connectionString = _config.GetConnectionString("DefaultConnection");

        using (var connection = new SqlConnection(connectionString))
        {
            using (var command = new SqlCommand("SPGetCalendarView", connection))
            {
                command.CommandType = CommandType.StoredProcedure;

                await connection.OpenAsync();
                using (var reader = await command.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        events.Add(new CalendarViewDto
                        {
                            BookingId     = reader.GetInt32(reader.GetOrdinal("BookingId")),
                            FullName      = reader.IsDBNull(reader.GetOrdinal("FullName"))      ? null : reader.GetString(reader.GetOrdinal("FullName")),
                            StartTime     = reader.IsDBNull(reader.GetOrdinal("Starttime"))     ? null : reader.GetDateTime(reader.GetOrdinal("Starttime")),
                            EndTime       = reader.IsDBNull(reader.GetOrdinal("EndTime"))       ? null : reader.GetDateTime(reader.GetOrdinal("EndTime")),
                            Customer      = reader.IsDBNull(reader.GetOrdinal("Customer"))      ? null : reader.GetString(reader.GetOrdinal("Customer")),
                            Duration      = reader.IsDBNull(reader.GetOrdinal("Duration"))      ? null : reader.GetString(reader.GetOrdinal("Duration")),
                            Language      = reader.IsDBNull(reader.GetOrdinal("Language"))      ? null : reader.GetString(reader.GetOrdinal("Language")),
                            Status        = reader.IsDBNull(reader.GetOrdinal("Status"))        ? null : reader.GetString(reader.GetOrdinal("Status")),
                            Int1          = reader.IsDBNull(reader.GetOrdinal("Int 1"))         ? null : reader.GetString(reader.GetOrdinal("Int 1")),
                            Int2          = reader.IsDBNull(reader.GetOrdinal("Int 2"))         ? null : reader.GetString(reader.GetOrdinal("Int 2")),
                            BookingStatus = reader.IsDBNull(reader.GetOrdinal("BookingStatus")) ? null : reader.GetInt32(reader.GetOrdinal("BookingStatus"))
                        });
                    }
                }
            }
        }

        return events;
    }
}