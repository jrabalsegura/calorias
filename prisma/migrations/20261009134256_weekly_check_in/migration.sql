-- CreateTable
CREATE TABLE "DiaryDay" (
    "day" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WeeklyCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" TEXT NOT NULL,
    "intakeKcal" INTEGER NOT NULL,
    "countedDays" INTEGER NOT NULL,
    "trendChangeKg" REAL NOT NULL,
    "weightSpanDays" INTEGER NOT NULL,
    "rawTdee" INTEGER NOT NULL,
    "estimatedTdee" INTEGER NOT NULL,
    "previousTarget" INTEGER NOT NULL,
    "proposedTarget" INTEGER NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCheckIn_weekStart_key" ON "WeeklyCheckIn"("weekStart");
