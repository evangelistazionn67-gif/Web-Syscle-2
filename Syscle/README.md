# Web-Syscle (bike parts shop)
ASP.NET Core 8 + MySQL. Two sides in one site: Customer (shop, cart, checkout, orders) and Admin (inventory with pictures, store-front categories, walk-in sales, transactions, payment setup, accounts).

## Run it
1. Install Visual Studio 2022 (workload: ASP.NET and web development) and MySQL Server 8 + MySQL Workbench.
2. In Workbench, open `Database/Syscle_MySQL.sql` and run it (lightning bolt). It creates `WebSyscleDB`.
3. In `Syscle.Web`, create `appsettings.Development.json` (it is git-ignored, so your password stays private):
   `{ "ConnectionStrings": { "Syscle": "Server=localhost;Port=3306;Database=WebSyscleDB;User ID=root;Password=YOUR_PASSWORD;" } }`
4. Open `Syscle.sln`, Build > Rebuild Solution, press F5.
5. First start creates demo logins: `admin` / `admin123` and `customer1` / `password123`. Change them before real use.

## Where things are
- `Syscle.Web/Program.cs`: all server code (login, roles, API, MySQL queries)
- `Syscle.Web/wwwroot/Pages` + `JavaScripts` + `Styles`: the website
- `Database/Syscle_MySQL.sql`: tables and starter data

## Team rules
Never commit passwords. Pull before you start, commit small, write a clear message.
