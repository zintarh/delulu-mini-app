-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "fid" INTEGER,
    "username" TEXT,
    "displayName" TEXT,
    "pfpUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delulu" (
    "id" TEXT NOT NULL,
    "onChainId" BIGINT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "content" TEXT,
    "creatorId" TEXT NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "stakingDeadline" TIMESTAMP(3) NOT NULL,
    "resolutionDeadline" TIMESTAMP(3) NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "outcome" BOOLEAN,
    "gatekeeperEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gatekeeperType" TEXT,
    "gatekeeperValue" TEXT,
    "gatekeeperLabel" TEXT,
    "bgImageUrl" TEXT,
    "totalBelieverStake" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDoubterStake" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delulu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deluluId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "side" BOOLEAN NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deluluId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "User_fid_key" ON "User"("fid");

-- CreateIndex
CREATE INDEX "User_address_idx" ON "User"("address");

-- CreateIndex
CREATE INDEX "User_fid_idx" ON "User"("fid");

-- CreateIndex
CREATE UNIQUE INDEX "Delulu_onChainId_key" ON "Delulu"("onChainId");

-- CreateIndex
CREATE INDEX "Delulu_creatorAddress_idx" ON "Delulu"("creatorAddress");

-- CreateIndex
CREATE INDEX "Delulu_onChainId_idx" ON "Delulu"("onChainId");

-- CreateIndex
CREATE INDEX "Delulu_stakingDeadline_idx" ON "Delulu"("stakingDeadline");

-- CreateIndex
CREATE INDEX "Delulu_isResolved_idx" ON "Delulu"("isResolved");

-- CreateIndex
CREATE UNIQUE INDEX "Stake_txHash_key" ON "Stake"("txHash");

-- CreateIndex
CREATE INDEX "Stake_userId_idx" ON "Stake"("userId");

-- CreateIndex
CREATE INDEX "Stake_deluluId_idx" ON "Stake"("deluluId");

-- CreateIndex
CREATE UNIQUE INDEX "Stake_userId_deluluId_side_key" ON "Stake"("userId", "deluluId", "side");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_txHash_key" ON "Claim"("txHash");

-- CreateIndex
CREATE INDEX "Claim_userId_idx" ON "Claim"("userId");

-- CreateIndex
CREATE INDEX "Claim_deluluId_idx" ON "Claim"("deluluId");

-- AddForeignKey
ALTER TABLE "Delulu" ADD CONSTRAINT "Delulu_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stake" ADD CONSTRAINT "Stake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stake" ADD CONSTRAINT "Stake_deluluId_fkey" FOREIGN KEY ("deluluId") REFERENCES "Delulu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_deluluId_fkey" FOREIGN KEY ("deluluId") REFERENCES "Delulu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
