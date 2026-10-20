USE WebSyscleDB;
-- Adds bundle offers to a database that already exists. Run once; safe to run again.
-- Demo tip: make two parts look "slow-moving" so the system bundles them, for example:
--   UPDATE Products SET AddedAt = NOW() - INTERVAL 60 DAY WHERE Name LIKE 'Shimano Tourney FD%';

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Products' AND COLUMN_NAME = 'AddedAt');
SET @s := IF(@c = 0, 'ALTER TABLE Products ADD COLUMN AddedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Orders' AND COLUMN_NAME = 'BundleDiscount');
SET @s := IF(@c = 0, 'ALTER TABLE Orders ADD COLUMN BundleDiscount DECIMAL(10,2) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

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

SELECT 'Bundle tables ready' AS Result;
