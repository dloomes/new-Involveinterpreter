public class CreateUserModel
{
    public string Email { get; set; } = "";
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public int CompanyId { get; set; }
    public List<string>? Roles { get; set; }
}

public class UpdateUserModel
{
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public int CompanyId { get; set; }
    public List<string>? Roles { get; set; }
}
