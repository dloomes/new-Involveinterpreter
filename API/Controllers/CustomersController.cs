using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IIAPI.Data;
using IIAPI.Models;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin")]
public class CustomersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CustomersController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/customers
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var customers = await _context.Customers
            .OrderBy(c => c.Name)
            .ToListAsync();
        return Ok(customers);
    }

    // GET: api/customers/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        return Ok(customer);
    }

    // POST: api/customers
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Customer model)
    {
        _context.Customers.Add(model);
        await _context.SaveChangesAsync();
        return Ok(model);
    }

    // PUT: api/customers/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] Customer model)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();

        customer.Name = model.Name;
        customer.SectorId = model.SectorId;
        customer.Contact = model.Contact;
        customer.ContactNumber = model.ContactNumber;
        customer.ContactEmail = model.ContactEmail;
        customer.InvoiceName = model.InvoiceName;
        customer.InvoiceEmail = model.InvoiceEmail;
        customer.BSLRateType = model.BSLRateType;
        customer.StatusId = model.StatusId;
        customer.AgreedRate = model.AgreedRate;
        customer.VRIATWCharge = model.VRIATWCharge;
        customer.VRIATWMins = model.VRIATWMins;
        customer.VRIATWLink = model.VRIATWLink;
        customer.VRIATW = model.VRIATW;

        await _context.SaveChangesAsync();
        return Ok(customer);
    }

    // DELETE: api/customers/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();

        _context.Customers.Remove(customer);
        await _context.SaveChangesAsync();
        return Ok();
    }
}
