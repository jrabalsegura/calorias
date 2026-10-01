-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "name" TEXT,
    "quantity" REAL,
    "unit" TEXT,
    "kcal" INTEGER NOT NULL,
    "foodId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "DiaryEntry_day_idx" ON "DiaryEntry"("day");
