using System.Collections.Concurrent;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);
var cs = builder.Configuration.GetConnectionString("Syscle") ?? throw new InvalidOperationException("Missing ConnectionStrings:Syscle in appsettings.json");
builder.Services.AddSingleton(new Db(cs));

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "syscle.auth";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    o.SlidingExpiration = true;
    o.Events.OnRedirectToLogin = c => { if (c.Request.Path.StartsWithSegments("/api")) c.Response.StatusCode = 401; else c.Response.Redirect("/index.html"); return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { if (c.Request.Path.StartsWithSegments("/api")) c.Response.StatusCode = 403; else c.Response.Redirect("/index.html"); return Task.CompletedTask; };
    o.Events.OnValidatePrincipal = Auth.Validate;
});
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Admin", p => p.RequireRole("Admin"))
    .AddPolicy("Customer", p => p.RequireRole("Customer"));

var app = builder.Build();
await Seed.RunAsync(cs, builder.Configuration);

app.UseAuthentication();
app.UseAuthorization();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    
    if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(ctx.Request.Method) && ctx.Request.Headers["X-Requested-With"] != "syscle")
    {
        ctx.Response.StatusCode = 400;
        await ctx.Response.WriteAsJsonAsync(new { error = "Bad request." });
        return;
    }

    var need = Gate.Required(ctx.Request.Path.Value ?? "");
    if (need != null)
    {
        if (ctx.User.Identity?.IsAuthenticated != true) { ctx.Response.Redirect("/index.html"); return; }
        var role = ctx.User.FindFirstValue(ClaimTypes.Role);
        if (need != "Any" && role != need) { ctx.Response.Redirect(role == "Admin" ? "/Pages/adminhomepage.html" : "/Pages/homepage.html"); return; }
    }
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();

IResult Bad(string m) => Results.BadRequest(new { error = m });
IResult Conflict(string m) => Results.Conflict(new { error = m });
int Uid(ClaimsPrincipal u) => int.Parse(u.FindFirstValue(ClaimTypes.NameIdentifier)!);
string? Nz(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();


var auth = app.MapGroup("/api/auth");
var tries = new ConcurrentDictionary<string, List<DateTime>>();

auth.MapPost("/register", async (RegisterReq r, Db db) =>
{
    var username = (r.Username ?? "").Trim(); var email = (r.Email ?? "").Trim();
    if (!Regex.IsMatch(username, @"^[A-Za-z0-9_.-]{3,50}$")) return Bad("Username must be 3-50 letters, numbers, dots, dashes or underscores.");
    if (email.Length > 120 || !Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$")) return Bad("Enter a valid email address.");
    if ((r.Password ?? "").Length < 8) return Bad("Password must be at least 8 characters.");
    using var c = db.Open();
    var taken = await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Users WHERE Username=@username OR Email=@email", new { username, email });
    if (taken > 0) return Conflict("That username or email is already registered.");

    await c.ExecuteAsync("INSERT INTO Users(Username,Email,PasswordHash,Role) VALUES(@username,@email,@h,'Customer')", new { username, email, h = Pw.Hash(r.Password!) });
    return Results.Ok(new { ok = true });
});

auth.MapPost("/login", async (LoginReq r, Db db, HttpContext ctx) =>
{
    var key = ctx.Connection.RemoteIpAddress + "|" + (r.Login ?? "").ToLowerInvariant();
    var list = tries.GetOrAdd(key, _ => new List<DateTime>());
    lock (list)
    {
        list.RemoveAll(t => t < DateTime.UtcNow.AddMinutes(-10));
        list.Add(DateTime.UtcNow);
        if (list.Count > 8) return Results.Json(new { error = "Too many attempts. Try again in a few minutes." }, statusCode: 429);
    }
    using var c = db.Open();
    var u = await c.QueryFirstOrDefaultAsync<UserRow>("SELECT UserId,Username,PasswordHash,Role,Status,SessionVersion FROM Users WHERE Username=@l OR Email=@l LIMIT 1", new { l = (r.Login ?? "").Trim() });
    if (u is null || !Pw.Verify(r.Password ?? "", u.PasswordHash)) return Results.Json(new { error = "Invalid credentials. Please try again." }, statusCode: 401);
    if (u.Status != "Active") return Results.Json(new { error = "This account is suspended. Please contact the store admin." }, statusCode: 403);
    var claims = new List<Claim>
    {
        new(ClaimTypes.NameIdentifier, u.UserId.ToString()), new(ClaimTypes.Name, u.Username),
        new(ClaimTypes.Role, u.Role), new("ver", u.SessionVersion.ToString())
    };
    await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
    return Results.Ok(new { username = u.Username, role = u.Role, redirect = u.Role == "Admin" ? "Pages/adminhomepage.html" : "Pages/homepage.html" });
});

auth.MapPost("/logout", async (HttpContext ctx) => { await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme); return Results.Ok(new { ok = true }); });

auth.MapPost("/forgot", async (ForgotReq r, Db db) =>
{
    using var c = db.Open();
    await c.ExecuteAsync("UPDATE Users SET FpRequest=1 WHERE Email=@e", new { e = (r.Email ?? "").Trim() });
    return Results.Ok(new { message = "If that email has an account, the store admin has been notified and will reset your password." });
});

auth.MapGet("/me", async (ClaimsPrincipal u, Db db) =>
{
    using var c = db.Open();
    return Results.Ok(await c.QueryFirstAsync("SELECT Username AS username, Email AS email, IFNULL(Phone,'') AS phone, Role AS role FROM Users WHERE UserId=@id", new { id = Uid(u) }));
}).RequireAuthorization();


var me = app.MapGroup("/api/me").RequireAuthorization();
me.MapPut("/profile", async (ProfileReq r, ClaimsPrincipal u, Db db) =>
{
    var email = (r.Email ?? "").Trim(); var phone = Nz(r.Phone);
    if (email.Length > 120 || !Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$")) return Bad("Enter a valid email address.");
    if (phone != null && !Regex.IsMatch(phone, @"^[0-9+() -]{7,30}$")) return Bad("Enter a valid contact number.");
    using var c = db.Open();
    if (await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Users WHERE Email=@email AND UserId<>@id", new { email, id = Uid(u) }) > 0) return Conflict("That email is already used by another account.");
    await c.ExecuteAsync("UPDATE Users SET Email=@email, Phone=@phone WHERE UserId=@id", new { email, phone, id = Uid(u) });
    return Results.Ok(new { ok = true });
});
me.MapPost("/password", async (PasswordReq r, ClaimsPrincipal u, Db db) =>
{
    if ((r.Next ?? "").Length < 8) return Bad("New password must be at least 8 characters.");
    using var c = db.Open();
    var hash = await c.ExecuteScalarAsync<string>("SELECT PasswordHash FROM Users WHERE UserId=@id", new { id = Uid(u) });
    if (hash is null || !Pw.Verify(r.Current ?? "", hash)) return Bad("Your current password is not correct.");
    await c.ExecuteAsync("UPDATE Users SET PasswordHash=@h WHERE UserId=@id", new { h = Pw.Hash(r.Next!), id = Uid(u) });
    return Results.Ok(new { ok = true });
});


app.MapGet("/api/categories", async (Db db) =>
{
    using var c = db.Open();
    return Results.Ok(await c.QueryAsync("SELECT CategoryId AS id, Name AS name, ImagePath AS image FROM Categories ORDER BY CategoryId"));
});
app.MapGet("/api/products", async (string? category, Db db) =>
{
    using var c = db.Open();
    return Results.Ok(await c.QueryAsync(@"SELECT p.ProductId AS id, p.Name AS name, p.ItemType AS itemType, p.Price AS price, p.Stock AS stock, p.ImagePath AS image, c.Name AS category
        FROM Products p JOIN Categories c ON c.CategoryId = p.CategoryId
        WHERE (@category IS NULL OR c.Name = @category) ORDER BY p.Name", new { category = Nz(category) }));
});


var shop = app.MapGroup("/api").RequireAuthorization("Customer");

shop.MapGet("/cart", async (ClaimsPrincipal u, Db db) =>
{
    using var c = db.Open();
    return Results.Ok(await c.QueryAsync(@"SELECT p.ProductId AS productId, p.Name AS name, p.ItemType AS itemType, p.Price AS price, p.Stock AS stock, p.ImagePath AS image, ci.Qty AS qty
        FROM CartItems ci JOIN Products p ON p.ProductId = ci.ProductId WHERE ci.UserId=@uid ORDER BY ci.AddedAt", new { uid = Uid(u) }));
});
shop.MapPost("/cart", async (CartReq r, ClaimsPrincipal u, Db db) =>
{
    if (r.Qty < 1 || r.Qty > 999) return Bad("Quantity must be at least 1.");
    using var c = db.Open();
    var stock = await c.ExecuteScalarAsync<int?>("SELECT Stock FROM Products WHERE ProductId=@id", new { id = r.ProductId });
    if (stock is null) return Results.NotFound(new { error = "That product is no longer available." });
    var uid = Uid(u);
    var have = await c.ExecuteScalarAsync<int?>("SELECT Qty FROM CartItems WHERE UserId=@uid AND ProductId=@id", new { uid, id = r.ProductId }) ?? 0;
    if (have + r.Qty > stock) return Conflict($"Only {stock} in stock ({have} already in your list).");
    await c.ExecuteAsync("INSERT INTO CartItems(UserId,ProductId,Qty) VALUES(@uid,@id,@q) ON DUPLICATE KEY UPDATE Qty=@q", new { uid, id = r.ProductId, q = have + r.Qty });
    return Results.Ok(new { ok = true });
});
shop.MapPut("/cart/{productId:int}", async (int productId, QtyReq r, ClaimsPrincipal u, Db db) =>
{
    using var c = db.Open();
    var uid = Uid(u);
    if (r.Qty <= 0) { await c.ExecuteAsync("DELETE FROM CartItems WHERE UserId=@uid AND ProductId=@productId", new { uid, productId }); return Results.Ok(new { ok = true }); }
    var stock = await c.ExecuteScalarAsync<int?>("SELECT Stock FROM Products WHERE ProductId=@productId", new { productId });
    if (stock is null) return Results.NotFound(new { error = "That product is no longer available." });
    if (r.Qty > stock) return Conflict($"Only {stock} in stock.");
    await c.ExecuteAsync("UPDATE CartItems SET Qty=@qty WHERE UserId=@uid AND ProductId=@productId", new { qty = r.Qty, uid, productId });
    return Results.Ok(new { ok = true });
});
shop.MapPost("/promo", async (PromoReq r, Db db) =>
{
    using var c = db.Open();
    var pct = await c.ExecuteScalarAsync<int?>("SELECT DiscountPercent FROM PromoCodes WHERE Code=@code AND IsActive=1", new { code = (r.Code ?? "").Trim() });
    return pct is null ? Results.NotFound(new { error = "That promo code is not valid." }) : Results.Ok(new { percent = pct });
});
shop.MapGet("/payment-methods", async (Db db) =>
{
    using var c = db.Open();
    return Results.Ok(await c.QueryAsync("SELECT MethodCode AS code, Label AS label, AccountNumber AS accountNumber, AccountName AS accountName FROM PaymentMethods WHERE IsOn=1"));
});
shop.MapPost("/checkout", async (CheckoutReq r, ClaimsPrincipal u, Db db) =>
{
    using var c = db.Open();
    using var tx = c.BeginTransaction();         
    var uid = Uid(u);
    var lines = (await c.QueryAsync<Line>("SELECT p.ProductId, p.Name, p.Price, ci.Qty FROM CartItems ci JOIN Products p ON p.ProductId=ci.ProductId WHERE ci.UserId=@uid", new { uid }, tx)).ToList();
    if (lines.Count == 0) return Bad("Your list is empty.");
    var method = await c.QueryFirstOrDefaultAsync<string>("SELECT Label FROM PaymentMethods WHERE MethodCode=@m AND IsOn=1", new { m = r.PaymentMethod }, tx);
    if (method is null) return Bad("Choose an available payment method.");
    if (r.PickupDate is null || r.PickupDate.Value.Date < DateTime.Today || r.PickupDate.Value.Date > DateTime.Today.AddDays(30)) return Bad("Pick a pick-up date within the next 30 days.");
    var pct = 0; string? code = null;
    if (!string.IsNullOrWhiteSpace(r.PromoCode))
    {
        code = r.PromoCode.Trim();
        var found = await c.ExecuteScalarAsync<int?>("SELECT DiscountPercent FROM PromoCodes WHERE Code=@code AND IsActive=1", new { code }, tx);
        if (found is null) return Bad("That promo code is not valid.");
        pct = found.Value;
    }
    var sub = lines.Sum(l => l.Price * l.Qty);              
    var discount = Math.Round(sub * pct / 100m, 2);
    var total = sub - discount;
    var name = await c.ExecuteScalarAsync<string>("SELECT Username FROM Users WHERE UserId=@uid", new { uid }, tx);
    await c.ExecuteAsync(@"INSERT INTO Orders(UserId,CustomerName,Channel,PaymentMethod,PromoCode,Discount,Total,Status,PickupDate)
        VALUES(@uid,@name,'Online',@method,@code,@discount,@total,'Pending',@pickup)",
        new { uid, name, method, code, discount, total, pickup = r.PickupDate.Value.Date }, tx);
    var orderId = await c.ExecuteScalarAsync<int>("SELECT CAST(LAST_INSERT_ID() AS SIGNED)", null, tx);
    var soldOut = await Orders.TakeStock(c, tx, orderId, lines);
    if (soldOut != null) return Conflict($"Sorry, {soldOut} just ran out of stock. Please update your list.");
    await c.ExecuteAsync("DELETE FROM CartItems WHERE UserId=@uid", new { uid }, tx);
    var orderCode = "ORD-" + orderId.ToString("D6");
    tx.Commit();
    return Results.Ok(new { orderCode, total });
});
shop.MapGet("/orders", async (ClaimsPrincipal u, Db db) =>
{
    using var c = db.Open();
    return Results.Ok(await c.QueryAsync(@"SELECT o.OrderId AS id, CONCAT(IF(o.Channel='Walk-in','WLK-','ORD-'), LPAD(o.OrderId,6,'0')) AS code, o.CreatedAt AS date, o.PickupDate AS pickup, o.PaymentMethod AS payment, o.Total AS total, o.Status AS status,
        (SELECT GROUP_CONCAT(CONCAT(oi.ProductName, ' x', oi.Qty) SEPARATOR ', ') FROM OrderItems oi WHERE oi.OrderId = o.OrderId) AS items
        FROM Orders o WHERE o.UserId=@uid ORDER BY o.OrderId DESC", new { uid = Uid(u) }));
});

shop.MapPost("/orders/{id:int}/cancel", async (int id, ClaimsPrincipal u, Db db) =>
{
    using var c = db.Open();
    using var tx = c.BeginTransaction();
    var st = await c.QueryFirstOrDefaultAsync<string>("SELECT Status FROM Orders WHERE OrderId=@id AND UserId=@uid FOR UPDATE", new { id, uid = Uid(u) }, tx);
    if (st is null) return Results.NotFound(new { error = "Order not found." });
    if (st != "Pending") return Conflict("Only pending orders can be cancelled. Please contact the store.");
    await c.ExecuteAsync("UPDATE Products p JOIN OrderItems oi ON oi.ProductId = p.ProductId SET p.Stock = p.Stock + oi.Qty WHERE oi.OrderId=@id", new { id }, tx);
    await c.ExecuteAsync("UPDATE Orders SET Status='Cancelled' WHERE OrderId=@id", new { id }, tx);
    tx.Commit();
    return Results.Ok(new { ok = true });
});


var admin = app.MapGroup("/api/admin").RequireAuthorization("Admin");


admin.MapPost("/categories", async (HttpRequest req, Db db, IWebHostEnvironment env) =>
{
    var form = await req.ReadFormAsync();
    var name = form["name"].ToString().Trim();
    if (name.Length < 1 || name.Length > 60) return Bad("Enter a category name (60 characters max).");
    string? path = null;
    var file = form.Files["image"];
    if (file is { Length: > 0 })
    {
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!new[] { ".jpg", ".jpeg", ".png", ".webp" }.Contains(ext) || file.Length > 2_000_000) return Bad("Image must be a .jpg, .png or .webp under 2 MB.");
        var dir = Path.Combine(env.WebRootPath, "Icons_and_Buttons");
        Directory.CreateDirectory(dir);
        var fn = $"cat_{Guid.NewGuid():N}{ext}";
        await using (var fs = File.Create(Path.Combine(dir, fn))) await file.CopyToAsync(fs);
        path = "../Icons_and_Buttons/" + fn;
    }
    using var c = db.Open();
    if (await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Categories WHERE Name=@name", new { name }) > 0) return Conflict("That category already exists.");
    await c.ExecuteAsync("INSERT INTO Categories(Name,ImagePath) VALUES(@name,@path)", new { name, path });
    return Results.Ok(new { ok = true });
});
admin.MapDelete("/categories/{id:int}", async (int id, Db db) =>
{
    using var c = db.Open();
    await c.ExecuteAsync("DELETE FROM Categories WHERE CategoryId=@id", new { id });   
    return Results.Ok(new { ok = true });
});

admin.MapPost("/categories/{id:int}/image", async (int id, HttpRequest req, Db db, IWebHostEnvironment env) =>
{
    using var c = db.Open();
    if (await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Categories WHERE CategoryId=@id", new { id }) == 0) return Results.NotFound(new { error = "Category not found." });
    var (path, error) = await Pics.SaveAsync(req, env.WebRootPath, "Icons_and_Buttons", "cat", 3_000_000);
    if (error != null) return Bad(error);
    await c.ExecuteAsync("UPDATE Categories SET ImagePath=@path WHERE CategoryId=@id", new { path, id });
    return Results.Ok(new { ok = true });
});

admin.MapGet("/stats", async (Db db) =>
{
    using var c = db.Open();
    var orders = await c.QueryFirstAsync(@"SELECT
        IFNULL(SUM(CASE WHEN Status<>'Cancelled' AND DATE(CreatedAt)=CURDATE() THEN Total END),0) AS todaySales,
        IFNULL(SUM(CASE WHEN DATE(CreatedAt)=CURDATE() THEN 1 ELSE 0 END),0) AS todayOrders,
        IFNULL(SUM(CASE WHEN Status='Pending' THEN 1 ELSE 0 END),0) AS pendingOrders,
        IFNULL(SUM(CASE WHEN Status<>'Cancelled' THEN Total END),0) AS totalSales FROM Orders");
    var prods = await c.QueryFirstAsync(@"SELECT COUNT(*) AS products,
        IFNULL(SUM(CASE WHEN Stock>0 AND Stock<=5 THEN 1 ELSE 0 END),0) AS lowStock,
        IFNULL(SUM(CASE WHEN Stock=0 THEN 1 ELSE 0 END),0) AS outOfStock FROM Products");
    var customers = await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Users WHERE Role='Customer'");
    var low = await c.QueryAsync("SELECT ProductId AS id, Name AS name, Stock AS stock, CategoryId AS categoryId FROM Products WHERE Stock<=5 ORDER BY Stock, Name LIMIT 6");
    var recent = await c.QueryAsync(@"SELECT CONCAT(IF(Channel='Walk-in','WLK-','ORD-'), LPAD(OrderId,6,'0')) AS code, CustomerName AS customer, Total AS total, Status AS status FROM Orders ORDER BY OrderId DESC LIMIT 6");
    return Results.Ok(new { orders, prods, customers, low, recent });
});


admin.MapGet("/products", async (Db db) =>
{
    using var c = db.Open();
    return Results.Ok(await c.QueryAsync(@"SELECT p.ProductId AS id, p.CategoryId AS categoryId, c.Name AS category, p.ItemType AS itemType, p.Name AS name, p.Price AS price, p.Stock AS stock, p.ImagePath AS image
        FROM Products p JOIN Categories c ON c.CategoryId = p.CategoryId ORDER BY c.Name, p.Name"));
});
string? CheckProduct(ProductReq r) =>
    string.IsNullOrWhiteSpace(r.Name) || r.Name.Trim().Length > 100 ? "Enter a product name (100 characters max)." :
    string.IsNullOrWhiteSpace(r.ItemType) || r.ItemType.Trim().Length > 60 ? "Enter an item type (60 characters max)." :
    r.Price < 0 || r.Price > 1_000_000 ? "Price must be between 0 and 1,000,000." :
    r.Stock < 0 || r.Stock > 100_000 ? "Stock must be between 0 and 100,000." : null;
admin.MapPost("/products", async (ProductReq r, Db db) =>
{
    var err = CheckProduct(r); if (err != null) return Bad(err);
    using var c = db.Open();
    if (await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Categories WHERE CategoryId=@CategoryId", new { r.CategoryId }) == 0) return Bad("Pick a category.");
    await c.ExecuteAsync("INSERT INTO Products(CategoryId,ItemType,Name,Price,Stock) VALUES(@CategoryId,@t,@n,@Price,@Stock)", new { r.CategoryId, t = r.ItemType!.Trim(), n = r.Name!.Trim(), r.Price, r.Stock });
    var newId = await c.ExecuteScalarAsync<int>("SELECT CAST(LAST_INSERT_ID() AS SIGNED)");
    return Results.Ok(new { ok = true, id = newId });
});
admin.MapPut("/products/{id:int}", async (int id, ProductReq r, Db db) =>
{
    var err = CheckProduct(r); if (err != null) return Bad(err);
    using var c = db.Open();
    var n = await c.ExecuteAsync("UPDATE Products SET CategoryId=@CategoryId, ItemType=@t, Name=@n, Price=@Price, Stock=@Stock WHERE ProductId=@id", new { id, r.CategoryId, t = r.ItemType!.Trim(), n = r.Name!.Trim(), r.Price, r.Stock });
    return n == 0 ? Results.NotFound(new { error = "Product not found." }) : Results.Ok(new { ok = true });
});
admin.MapDelete("/products/{id:int}", async (int id, Db db) =>
{
    using var c = db.Open();
    await c.ExecuteAsync("DELETE FROM Products WHERE ProductId=@id", new { id });
    return Results.Ok(new { ok = true });
});
admin.MapPost("/products/{id:int}/stock", async (int id, StockReq r, Db db) =>
{
    using var c = db.Open();
    var n = await c.ExecuteAsync("UPDATE Products SET Stock=Stock+@d WHERE ProductId=@id AND Stock+@d>=0", new { d = r.Delta, id });
    return n == 0 ? Conflict("Stock can't go below zero.") : Results.Ok(new { ok = true });
});

admin.MapPost("/products/{id:int}/image", async (int id, HttpRequest req, Db db, IWebHostEnvironment env) =>
{
    var form = await req.ReadFormAsync();
    var file = form.Files["image"];
    if (file is null || file.Length == 0) return Bad("Choose a picture first.");
    var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (!new[] { ".jpg", ".jpeg", ".png", ".webp" }.Contains(ext) || file.Length > 3_000_000) return Bad("Picture must be a .jpg, .png or .webp under 3 MB.");
    using var c = db.Open();
    if (await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Products WHERE ProductId=@id", new { id }) == 0) return Results.NotFound(new { error = "Product not found." });
    var dir = Path.Combine(env.WebRootPath, "Products");
    Directory.CreateDirectory(dir);
    var fn = $"prod_{Guid.NewGuid():N}{ext}";
    await using (var fs = File.Create(Path.Combine(dir, fn))) await file.CopyToAsync(fs);
    await c.ExecuteAsync("UPDATE Products SET ImagePath=@p WHERE ProductId=@id", new { p = "/Products/" + fn, id });
    return Results.Ok(new { ok = true });
});


admin.MapGet("/transactions", async (string? search, string? status, string? range, Db db) =>
{
    DateTime? since = range switch { "today" => DateTime.Today, "7" => DateTime.Today.AddDays(-6), "30" => DateTime.Today.AddDays(-29), _ => null };
    using var c = db.Open();
    var rows = await c.QueryAsync(@"SELECT o.OrderId AS id, CONCAT(IF(o.Channel='Walk-in','WLK-','ORD-'), LPAD(o.OrderId,6,'0')) AS code, o.CreatedAt AS date, o.CustomerName AS customer, o.Channel AS channel,
            o.PaymentMethod AS payment, o.Total AS total, o.Status AS status, o.PickupDate AS pickup,
            (SELECT GROUP_CONCAT(CONCAT(oi.ProductName, ' x', oi.Qty) SEPARATOR ', ') FROM OrderItems oi WHERE oi.OrderId = o.OrderId) AS items
        FROM Orders o
        WHERE (@search IS NULL OR CONCAT(IF(o.Channel='Walk-in','WLK-','ORD-'), LPAD(o.OrderId,6,'0')) LIKE @like OR o.CustomerName LIKE @like)
          AND (@status IS NULL OR o.Status = @status)
          AND (@since IS NULL OR o.CreatedAt >= @since)
        ORDER BY o.OrderId DESC", new { search = Nz(search), like = "%" + Nz(search) + "%", status = Nz(status), since });
    var summary = await c.QueryFirstAsync(@"SELECT COUNT(*) AS total,
            IFNULL(SUM(CASE WHEN Status='Completed' THEN 1 ELSE 0 END),0) AS completed,
            IFNULL(SUM(CASE WHEN Status='Pending'   THEN 1 ELSE 0 END),0) AS pending,
            IFNULL(SUM(CASE WHEN Status='Cancelled' THEN 1 ELSE 0 END),0) AS cancelled FROM Orders");
    return Results.Ok(new { summary, rows });
});
admin.MapPost("/transactions/walkin", async (WalkinReq r, Db db) =>
{
    if (r.Items is null || r.Items.Count == 0) return Bad("Add at least one item.");
    if (r.Items.Any(i => i.Qty < 1)) return Bad("Quantities must be at least 1.");
    using var c = db.Open();
    using var tx = c.BeginTransaction();
    var method = await c.QueryFirstOrDefaultAsync<string>("SELECT Label FROM PaymentMethods WHERE MethodCode=@m AND IsOn=1", new { m = r.PaymentMethod }, tx);
    if (method is null) return Bad("Choose an available payment method.");
    var lines = new List<Line>();
    foreach (var g in r.Items.GroupBy(i => i.ProductId))
    {
        var p = await c.QueryFirstOrDefaultAsync<Line>("SELECT ProductId, Name, Price, 0 AS Qty FROM Products WHERE ProductId=@id", new { id = g.Key }, tx);
        if (p is null) return Bad("One of the items no longer exists.");
        p.Qty = g.Sum(x => x.Qty);
        lines.Add(p);
    }
    var total = lines.Sum(l => l.Price * l.Qty);
    var cust = Nz(r.CustomerName) ?? "Walk-in"; if (cust.Length > 80) cust = cust[..80];
    await c.ExecuteAsync(@"INSERT INTO Orders(UserId,CustomerName,Channel,PaymentMethod,Discount,Total,Status)
        VALUES(NULL,@cust,'Walk-in',@method,0,@total,'Completed')", new { cust, method, total }, tx);
    var orderId = await c.ExecuteScalarAsync<int>("SELECT CAST(LAST_INSERT_ID() AS SIGNED)", null, tx);
    var soldOut = await Orders.TakeStock(c, tx, orderId, lines);
    if (soldOut != null) return Conflict($"Not enough stock for {soldOut}.");
    var orderCode = "WLK-" + orderId.ToString("D6");
    tx.Commit();
    return Results.Ok(new { orderCode, total });
});
admin.MapPut("/transactions/{id:int}/status", async (int id, StatusReq r, Db db) =>
{
    if (r.Status is not ("Completed" or "Cancelled")) return Bad("Unknown status.");
    using var c = db.Open();
    using var tx = c.BeginTransaction();
    var cur = await c.QueryFirstOrDefaultAsync<string>("SELECT Status FROM Orders WHERE OrderId=@id FOR UPDATE", new { id }, tx);
    if (cur is null) return Results.NotFound(new { error = "Transaction not found." });
    if (cur == "Cancelled") return Conflict("Cancelled transactions can't be changed.");
    if (r.Status == "Cancelled")   // put the stock back
        await c.ExecuteAsync("UPDATE Products p JOIN OrderItems oi ON oi.ProductId = p.ProductId SET p.Stock = p.Stock + oi.Qty WHERE oi.OrderId=@id", new { id }, tx);
    await c.ExecuteAsync("UPDATE Orders SET Status=@s WHERE OrderId=@id", new { s = r.Status, id }, tx);
    tx.Commit();
    return Results.Ok(new { ok = true });
});


admin.MapGet("/payment-methods", async (Db db) =>
{
    using var c = db.Open();
    return Results.Ok(await c.QueryAsync("SELECT MethodCode AS code, Label AS label, IsOn AS isOn, IFNULL(AccountNumber,'') AS accountNumber, IFNULL(AccountName,'') AS accountName FROM PaymentMethods ORDER BY MethodCode"));
});
admin.MapPut("/payment-methods", async (List<MethodReq> list, Db db) =>
{
    using var c = db.Open();
    foreach (var m in list)
        await c.ExecuteAsync("UPDATE PaymentMethods SET IsOn=@IsOn, AccountNumber=@num, AccountName=@name WHERE MethodCode=@Code",
            new { m.Code, m.IsOn, num = Nz(m.AccountNumber), name = Nz(m.AccountName) });
    return Results.Ok(new { ok = true });
});


admin.MapGet("/accounts", async (Db db) =>
{
    using var c = db.Open();
    return Results.Ok(await c.QueryAsync(@"SELECT UserId AS id, Username AS username, Email AS email, IFNULL(Phone,'') AS phone, Role AS role, Status AS status,
        IF(Status='Active' AND LastSeen > DATE_SUB(NOW(), INTERVAL 5 MINUTE), 1, 0) AS online, FpRequest AS fpRequest
        FROM Users ORDER BY Role, Username"));
});
admin.MapPost("/accounts", async (NewAdminReq r, Db db) =>
{
    var username = (r.Username ?? "").Trim(); var email = (r.Email ?? "").Trim();
    if (!Regex.IsMatch(username, @"^[A-Za-z0-9_.-]{3,50}$")) return Bad("Username must be 3-50 letters, numbers, dots, dashes or underscores.");
    if (email.Length > 120 || !Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$")) return Bad("Enter a valid email address.");
    if ((r.Password ?? "").Length < 8) return Bad("Password must be at least 8 characters.");
    using var c = db.Open();
    if (await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Users WHERE Username=@username OR Email=@email", new { username, email }) > 0) return Conflict("That username or email is already registered.");
    await c.ExecuteAsync("INSERT INTO Users(Username,Email,PasswordHash,Role) VALUES(@username,@email,@h,'Admin')", new { username, email, h = Pw.Hash(r.Password!) });
    return Results.Ok(new { ok = true });
});
admin.MapPost("/accounts/{id:int}/suspend", async (int id, SuspendReq r, ClaimsPrincipal u, Db db) =>
{
    if (id == Uid(u)) return Bad("You can't suspend your own account.");
    using var c = db.Open();
    await c.ExecuteAsync("UPDATE Users SET Status=@s, SessionVersion=SessionVersion+1 WHERE UserId=@id", new { s = r.Suspend ? "Suspended" : "Active", id });
    return Results.Ok(new { ok = true });
});
admin.MapPost("/accounts/{id:int}/logout", async (int id, Db db) =>
{
    using var c = db.Open();
    await c.ExecuteAsync("UPDATE Users SET SessionVersion=SessionVersion+1 WHERE UserId=@id", new { id });
    return Results.Ok(new { ok = true });
});
admin.MapPost("/accounts/{id:int}/password", async (int id, PasswordSetReq r, ClaimsPrincipal u, Db db) =>
{
    if ((r.Password ?? "").Length < 8) return Bad("Password must be at least 8 characters.");
    using var c = db.Open();
    var bump = id == Uid(u) ? 0 : 1;  
    await c.ExecuteAsync("UPDATE Users SET PasswordHash=@h, FpRequest=0, SessionVersion=SessionVersion+@bump WHERE UserId=@id", new { h = Pw.Hash(r.Password!), bump, id });
    return Results.Ok(new { ok = true });
});
admin.MapDelete("/accounts/{id:int}", async (int id, ClaimsPrincipal u, Db db) =>
{
    if (id == Uid(u)) return Bad("You can't delete your own account.");
    using var c = db.Open();
    await c.ExecuteAsync("DELETE FROM Users WHERE UserId=@id", new { id });
    return Results.Ok(new { ok = true });
});

app.Run();


record RegisterReq(string? Username, string? Email, string? Password);
record LoginReq(string? Login, string? Password);
record ForgotReq(string? Email);
record ProfileReq(string? Email, string? Phone);
record PasswordReq(string? Current, string? Next);
record CartReq(int ProductId, int Qty);
record QtyReq(int Qty);
record PromoReq(string? Code);
record CheckoutReq(DateTime? PickupDate, string? PromoCode, string? PaymentMethod);
record ItemReq(int ProductId, int Qty);
record WalkinReq(string? CustomerName, string? PaymentMethod, List<ItemReq>? Items);
record StatusReq(string? Status);
record ProductReq(int CategoryId, string? ItemType, string? Name, decimal Price, int Stock);
record StockReq(int Delta);
record MethodReq(string Code, bool IsOn, string? AccountNumber, string? AccountName);
record NewAdminReq(string? Username, string? Email, string? Password);
record SuspendReq(bool Suspend);
record PasswordSetReq(string? Password);

class UserRow { public int UserId { get; set; } public string Username { get; set; } = ""; public string PasswordHash { get; set; } = ""; public string Role { get; set; } = ""; public string Status { get; set; } = ""; public int SessionVersion { get; set; } }
class SessionRow { public string Role { get; set; } = ""; public string Status { get; set; } = ""; public int SessionVersion { get; set; } }
class Line { public int ProductId { get; set; } public string Name { get; set; } = ""; public decimal Price { get; set; } public int Qty { get; set; } }

class Db
{
    private readonly string _cs;
    public Db(string cs) { _cs = cs; }
    public MySqlConnection Open() { var c = new MySqlConnection(_cs); c.Open(); return c; }
}

static class Pics
{
  
    public static async Task<(string? path, string? error)> SaveAsync(HttpRequest req, string webRoot, string folder, string prefix, long maxBytes)
    {
        var form = await req.ReadFormAsync();
        var file = form.Files["image"];
        if (file is null || file.Length == 0) return (null, "Choose a picture first.");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!new[] { ".jpg", ".jpeg", ".png", ".webp" }.Contains(ext) || file.Length > maxBytes) return (null, "Picture must be a .jpg, .png or .webp under 3 MB.");
        var dir = Path.Combine(webRoot, folder);
        Directory.CreateDirectory(dir);
        var fn = $"{prefix}_{Guid.NewGuid():N}{ext}";
        await using (var fs = File.Create(Path.Combine(dir, fn))) await file.CopyToAsync(fs);
        return ("/" + folder + "/" + fn, null);
    }
}

static class Orders
{
 
    public static async Task<string?> TakeStock(MySqlConnection c, MySqlTransaction tx, int orderId, List<Line> lines)
    {
        foreach (var l in lines)
        {
            var n = await c.ExecuteAsync("UPDATE Products SET Stock=Stock-@q WHERE ProductId=@id AND Stock>=@q", new { q = l.Qty, id = l.ProductId }, tx);
            if (n == 0) return l.Name;
            await c.ExecuteAsync("INSERT INTO OrderItems(OrderId,ProductId,ProductName,UnitPrice,Qty) VALUES(@orderId,@id,@name,@price,@q)",
                new { orderId, id = l.ProductId, name = l.Name, price = l.Price, q = l.Qty }, tx);
        }
        return null;
    }
}

static class Gate
{

    public static string? Required(string path)
    {
        var p = path.ToLowerInvariant();
        string file = p.Substring(p.LastIndexOf('/') + 1);
        if (p.StartsWith("/pages/"))
        {
            if (file == "error.html") return null;
            if (file.StartsWith("admin")) return "Admin";
            if (file == "account.html") return "Any";
            return "Customer";
        }
        if (p.StartsWith("/javascripts/"))
        {
            if (file == "api.js") return null;
            if (file.StartsWith("admin")) return "Admin";
            if (file == "account.js") return "Any";
            return "Customer";
        }
        return null;
    }
}

static class Pw
{
    public static string Hash(string pw)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var h = Rfc2898DeriveBytes.Pbkdf2(pw, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"v1.100000.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(h)}";
    }
    public static bool Verify(string pw, string stored)
    {
        var p = stored.Split('.');
        if (p.Length != 4) return false;
        var salt = Convert.FromBase64String(p[2]); var expected = Convert.FromBase64String(p[3]);
        var h = Rfc2898DeriveBytes.Pbkdf2(pw, salt, int.Parse(p[1]), HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(h, expected);
    }
}

static class Auth
{

    public static async Task Validate(CookieValidatePrincipalContext ctx)
    {
        var id = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var db = ctx.HttpContext.RequestServices.GetRequiredService<Db>();
        SessionRow? s = null;
        if (int.TryParse(id, out var uid))
        {
            using var c = db.Open();
            s = await c.QueryFirstOrDefaultAsync<SessionRow>("SELECT Role, Status, SessionVersion FROM Users WHERE UserId=@uid", new { uid });
            await c.ExecuteAsync("UPDATE Users SET LastSeen = NOW() WHERE UserId=@uid AND (LastSeen IS NULL OR LastSeen < DATE_SUB(NOW(), INTERVAL 1 MINUTE))", new { uid });
        }
        if (s is null || s.Status != "Active" || s.Role != ctx.Principal!.FindFirstValue(ClaimTypes.Role) || s.SessionVersion.ToString() != ctx.Principal.FindFirstValue("ver"))
        {
            ctx.RejectPrincipal();
            await ctx.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        }
    }
}

static class Seed
{
    public static async Task RunAsync(string cs, IConfiguration cfg)
    {
        try
        {
            using var c = new MySqlConnection(cs);
            await c.OpenAsync();
            if (await c.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM Users") > 0) return;
            var adminPw = cfg["Seed:AdminPassword"] ?? "admin123";
            var custPw = cfg["Seed:CustomerPassword"] ?? "password123";
            await c.ExecuteAsync("INSERT INTO Users(Username,Email,PasswordHash,Role) VALUES ('admin','admin@syscle.com',@a,'Admin'),('customer1','customer@syscle.com',@b,'Customer')",
                new { a = Pw.Hash(adminPw), b = Pw.Hash(custPw) });
            Console.WriteLine("[Syscle] Created demo accounts: admin / admin123 and customer1 / password123. Change them before real use.");
        }
        catch (Exception e)
        {
            Console.WriteLine("[Syscle] Could not reach the database: " + e.Message);
            Console.WriteLine("[Syscle] Run Database/Syscle_MySQL.sql in MySQL Workbench first, then check the connection string (appsettings.Development.json).");
        }
    }
}
