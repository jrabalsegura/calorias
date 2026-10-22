-- CreateTable
CREATE TABLE "SavedMeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SavedMealItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "savedMealId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "quantity" REAL,
    "unit" TEXT,
    "kcal" INTEGER NOT NULL,
    "foodId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    CONSTRAINT "SavedMealItem_savedMealId_fkey" FOREIGN KEY ("savedMealId") REFERENCES "SavedMeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedMealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SavedMealItem_savedMealId_idx" ON "SavedMealItem"("savedMealId");

-- CreateIndex
CREATE INDEX "SavedMealItem_foodId_idx" ON "SavedMealItem"("foodId");
