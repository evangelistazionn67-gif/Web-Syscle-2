-- Web-Syscle database for MySQL 8 (MySQL Workbench).
-- Based on the group's WebSyscleDB.sql, extended with what the website needs (see README).
-- Run the whole script: File > Open SQL Script, then click the lightning-bolt Execute button. Safe to run again.
-- Admin and demo accounts are created by the website on first start (the app hashes the passwords).

CREATE DATABASE IF NOT EXISTS WebSyscleDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE WebSyscleDB;

-- One table for everyone; Role separates the Admin side from the Customer side.
CREATE TABLE IF NOT EXISTS Users (
  UserId         INT AUTO_INCREMENT PRIMARY KEY,
  Username       VARCHAR(50)  NOT NULL UNIQUE,
  Email          VARCHAR(120) NOT NULL UNIQUE,
  Phone          VARCHAR(30)  NULL,
  PasswordHash   VARCHAR(200) NOT NULL,
  Role           ENUM('Admin','Customer') NOT NULL,
  Status         ENUM('Active','Suspended') NOT NULL DEFAULT 'Active',
  FpRequest      TINYINT(1)   NOT NULL DEFAULT 0,
  SessionVersion INT          NOT NULL DEFAULT 0,
  LastSeen       DATETIME     NULL,
  CreatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bike-type tiles on the storefront (Mountain Bikes, Road Bikes, ...), with a picture each.
CREATE TABLE IF NOT EXISTS Categories (
  CategoryId INT AUTO_INCREMENT PRIMARY KEY,
  Name       VARCHAR(60)  NOT NULL UNIQUE,
  ImagePath  VARCHAR(260) NULL
) ENGINE=InnoDB;

-- Parts. ItemType is the part type from the group's Category table (Derailleur, Rims, Tire, ...).
CREATE TABLE IF NOT EXISTS Products (
  ProductId  INT AUTO_INCREMENT PRIMARY KEY,
  CategoryId INT NOT NULL,
  ItemType   VARCHAR(60)    NOT NULL,
  Name       VARCHAR(100)   NOT NULL,
  Price      DECIMAL(10,2)  NOT NULL CHECK (Price >= 0),
  Stock      INT            NOT NULL CHECK (Stock >= 0),
  ImagePath  VARCHAR(260)   NULL,
  AddedAt    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (CategoryId) REFERENCES Categories(CategoryId) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CartItems (
  UserId    INT NOT NULL,
  ProductId INT NOT NULL,
  Qty       INT NOT NULL CHECK (Qty > 0),
  AddedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (UserId, ProductId),
  FOREIGN KEY (UserId)    REFERENCES Users(UserId)       ON DELETE CASCADE,
  FOREIGN KEY (ProductId) REFERENCES Products(ProductId) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PaymentMethods (
  MethodCode    VARCHAR(20) PRIMARY KEY,
  Label         VARCHAR(60) NOT NULL,
  IsOn          TINYINT(1)  NOT NULL DEFAULT 1,
  AccountNumber VARCHAR(60) NULL,
  AccountName   VARCHAR(80) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PromoCodes (
  Code            VARCHAR(30) PRIMARY KEY,
  DiscountPercent INT NOT NULL CHECK (DiscountPercent BETWEEN 1 AND 90),
  IsActive        TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- Online orders and walk-in sales. The order number (ORD-000001 / WLK-000001) is built from OrderId + Channel.
CREATE TABLE IF NOT EXISTS Orders (
  OrderId       INT AUTO_INCREMENT PRIMARY KEY,
  UserId        INT NULL,
  CustomerName  VARCHAR(80)   NOT NULL,
  Channel       ENUM('Online','Walk-in') NOT NULL,
  PaymentMethod VARCHAR(60)   NOT NULL,
  PromoCode     VARCHAR(30)   NULL,
  Discount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  BundleDiscount DECIMAL(10,2) NOT NULL DEFAULT 0,
  Total         DECIMAL(10,2) NOT NULL,
  Status        ENUM('Pending','Completed','Cancelled') NOT NULL,
  PickupDate    DATE NULL,
  CreatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS OrderItems (
  OrderItemId INT AUTO_INCREMENT PRIMARY KEY,
  OrderId     INT NOT NULL,
  ProductId   INT NULL,
  ProductName VARCHAR(100)  NOT NULL,   -- snapshot, so history survives product edits and deletes
  UnitPrice   DECIMAL(10,2) NOT NULL,
  Qty         INT NOT NULL CHECK (Qty > 0),
  FOREIGN KEY (OrderId)   REFERENCES Orders(OrderId)     ON DELETE CASCADE,
  FOREIGN KEY (ProductId) REFERENCES Products(ProductId) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Bundle offers: the system pairs a slow-moving part with a popular one at a 5-10% discount.
CREATE TABLE IF NOT EXISTS Bundles (
  BundleId        INT AUTO_INCREMENT PRIMARY KEY,
  Name            VARCHAR(160) NOT NULL,
  DiscountPercent INT NOT NULL CHECK (DiscountPercent BETWEEN 5 AND 10),
  IsActive        TINYINT(1) NOT NULL DEFAULT 1,
  AutoMade        TINYINT(1) NOT NULL DEFAULT 0,
  CreatedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS BundleItems (
  BundleId  INT NOT NULL,
  ProductId INT NOT NULL,
  Qty       INT NOT NULL DEFAULT 1 CHECK (Qty > 0),
  PRIMARY KEY (BundleId, ProductId),
  FOREIGN KEY (BundleId)  REFERENCES Bundles(BundleId)   ON DELETE CASCADE,
  FOREIGN KEY (ProductId) REFERENCES Products(ProductId) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CartBundles (
  UserId   INT NOT NULL,
  BundleId INT NOT NULL,
  Qty      INT NOT NULL CHECK (Qty > 0),
  PRIMARY KEY (UserId, BundleId),
  FOREIGN KEY (UserId)   REFERENCES Users(UserId)     ON DELETE CASCADE,
  FOREIGN KEY (BundleId) REFERENCES Bundles(BundleId) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- starter data (only inserted while the tables are empty) ----------
INSERT INTO Categories (Name)
SELECT t.n FROM (
  SELECT 'Mountain Bikes' AS n UNION ALL SELECT 'Road Bikes' UNION ALL SELECT 'Fixies / Fixed Gears'
  UNION ALL SELECT 'Gravel Bikes' UNION ALL SELECT 'Accessories' UNION ALL SELECT 'Others'
) t WHERE NOT EXISTS (SELECT 1 FROM Categories);

-- Prices and names follow ItemList.txt. Stock starts at 20 (change it in Inventory Management).
INSERT INTO Products (CategoryId, ItemType, Name, Price, Stock, ImagePath)
SELECT c.CategoryId, v.ItemType, v.Name, v.Price, v.Stock, v.ImagePath
FROM (
  SELECT 'Mountain Bikes' AS CatName, 'Crankarm (MTB)' AS ItemType, 'Shimano Tourney Crank 3 Speed' AS Name, 250 AS Price, 20 AS Stock, '/Products/shimano-tourney-crank.jpg' AS ImagePath
  UNION ALL SELECT 'Mountain Bikes', 'Rims', 'Sagmit Evo 3 Rims 26/27.5/29', 1200, 20, '/Products/sagmit-evo3-rims.jpg'
  UNION ALL SELECT 'Mountain Bikes', 'Tire', 'Maxxis Pace 26/27.5/29', 1100, 20, '/Products/maxxis-pace.jpg'
  UNION ALL SELECT 'Road Bikes', 'Rims', 'Ragusa Rims 700c', 1000, 20, '/Products/ragusa-rims-700c.jpg'
  UNION ALL SELECT 'Road Bikes', 'Tire', 'Chaoyang Sharkskin Tires 700c x (23/25/28)', 650, 20, '/Products/chaoyang-sharkskin.jpg'
  UNION ALL SELECT 'Accessories', 'Cockpit', 'Sagmit Evo 3 Handle Bar', 700, 20, '/Products/sagmit-handlebar.jpg'
  UNION ALL SELECT 'Accessories', 'Cockpit', 'Sagmit Evo 3 Seatpost 27.2/31.6', 650, 20, '/Products/sagmit-seatpost.jpg'
  UNION ALL SELECT 'Accessories', 'Cockpit', 'Sagmit Safari Saddle', 700, 20, '/Products/sagmit-saddle.jpg'
  UNION ALL SELECT 'Accessories', 'Cockpit', 'Sagmit Systemone Stem', 650, 20, '/Products/sagmit-stem.jpg'
  UNION ALL SELECT 'Others', 'Derailleur', 'Shimano Tourney RD', 250, 20, '/Products/shimano-tourney-rd.jpg'
  UNION ALL SELECT 'Others', 'Derailleur', 'Shimano Tourney FD', 200, 20, '/Products/shimano-tourney-fd.jpg'
  UNION ALL SELECT 'Others', 'Innertube', 'VeloStrim Innertubes 26/27.5/29/700c (23-45c)', 180, 20, '/Products/velostrim-innertubes.jpg'
  UNION ALL SELECT 'Others', 'Spokes', 'Sagmit Spokes 26/27.5/29/700c', 450, 20, '/Products/sagmit-spokes.jpg'
) v JOIN Categories c ON c.Name = v.CatName
WHERE NOT EXISTS (SELECT 1 FROM Products);

INSERT INTO PaymentMethods (MethodCode, Label, IsOn)
SELECT t.code, t.label, 1 FROM (SELECT 'cash' AS code, 'Cash' AS label UNION ALL SELECT 'gcash', 'GCash') t
WHERE NOT EXISTS (SELECT 1 FROM PaymentMethods);

INSERT INTO PromoCodes (Code, DiscountPercent)
SELECT 'SYSCLE10', 10 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM PromoCodes);

-- Check: should show 6 categories, 13 products, 2 payment methods
SELECT (SELECT COUNT(*) FROM Categories) AS Categories, (SELECT COUNT(*) FROM Products) AS Products, (SELECT COUNT(*) FROM PaymentMethods) AS PaymentMethods;
