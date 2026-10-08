-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'profile',
    "sex" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "heightCm" REAL NOT NULL,
    "activity" TEXT NOT NULL,
    "targetWeightKg" REAL NOT NULL,
    "pace" TEXT NOT NULL,
    "manualTargetKcal" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WeightEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "day" TEXT NOT NULL,
    "kg" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WeightEntry_day_key" ON "WeightEntry"("day");
