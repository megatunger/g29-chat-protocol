-- CreateTable
CREATE TABLE "Client" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assigned_id" TEXT NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pubkey" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER,
    "name" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_pubkey_key" ON "Client"("pubkey");
