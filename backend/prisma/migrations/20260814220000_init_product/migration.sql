-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "marca" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL,
    "imgUrl" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Product_stock_nonnegative" CHECK ("stock" >= 0)
);
