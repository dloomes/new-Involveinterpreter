using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IIAPI.Data;

[Route("api/[controller]")]
[ApiController]
public class LookupsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public LookupsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("durations")]
    public async Task<IActionResult> GetDurations()
    {
        var durations = await _context.Duration
            .Select(d => new
            {
                d.Id,
                d.Duration,
                d.DurationValue
            })
            .ToListAsync();

        return Ok(durations);
    }

    [HttpGet("bookingtypes")]
    public async Task<IActionResult> GetBookingTypes()
    {
        var types = await _context.BookingType
            .Select(t => new
            {
                t.Id,
                t.BookingType
            })
            .ToListAsync();

        return Ok(types);
    }

    [HttpGet("sectors")]
    public async Task<IActionResult> GetSectors()
    {
        var sectors = await _context.CustSectors
            .OrderBy(s => s.Sector)
            .Select(s => new { s.Id, s.Sector })
            .ToListAsync();
        return Ok(sectors);
    }

    [HttpGet("customerstatuses")]
    public async Task<IActionResult> GetCustomerStatuses()
    {
        var statuses = await _context.CustomerStatuses
            .OrderBy(s => s.Status)
            .Select(s => new { s.Id, s.Status })
            .ToListAsync();
        return Ok(statuses);
    }

    [HttpGet("bslratetypes")]
    public async Task<IActionResult> GetBSLRateTypes()
    {
        var types = await _context.BSLRateTypes
            .OrderBy(t => t.RateType)
            .Select(t => new { t.Id, t.RateType })
            .ToListAsync();
        return Ok(types);
    }
}