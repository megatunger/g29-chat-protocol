-- CreateTable
CREATE TABLE "Client" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userID" TEXT NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pubkey" TEXT NOT NULL,
    "version" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_userID_key" ON "Client"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "Client_pubkey_key" ON "Client"("pubkey");
