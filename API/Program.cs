using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using IIAPI.Data;
using IIAPI.Models;
using System.Reflection.Metadata;


var builder = WebApplication.CreateBuilder(args);

// Add DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();
//Add Booking Service
builder.Services.AddScoped<BookingService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<SqodService>();
builder.Services.AddScoped<GraphCalendarService>();

// Add JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;

    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            Console.WriteLine("AUTH FAILED: " + context.Exception?.Message);
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            
            return Task.CompletedTask;
        },
        OnMessageReceived = context =>
        {
            context.Token = context.Request.Cookies["access_token"];
            //context.Token = context.Request.Cookies["ARRAffinity"];
            return Task.CompletedTask;
        }
    };

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
    };
});

// Add Controllers
builder.Services.AddControllers();
builder.Services.AddCors();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAuthorization();

var app = builder.Build();

// Swagger — available in Development and Staging, not Production
if (!app.Environment.IsProduction())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Serve the React SPA from wwwroot (built by: cd ii-client && npm run build)
app.UseDefaultFiles();
app.UseStaticFiles();

// CORS — only needed for local dev (same-origin in Azure)
app.UseCors(policy =>
    policy.WithOrigins(
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:7046",
        "http://localhost:5184"
    )
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials());

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Fallback to index.html so React Router handles client-side navigation
app.MapFallbackToFile("index.html");

app.Run();
