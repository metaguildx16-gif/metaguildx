/**
 * scan-historical-income.ts
 * Historical qualifying income scanner with same-block U_NEW hardening.
 *
 * Events sourced from IncomeEngine + UpgradeEngine (NOT Core proxy).
 * UserRegistered sourced from Core proxy.
 *
 * Usage:
 *   U_NEW_BLOCK=<block> U_NEW_TX_INDEX=<txIndex> \
 *   npx hardhat run scripts/scan-historical-income.ts --network opbnbMainnet
 */
import { ethers } from "hardhat";
import * as fs from "fs";

const INCOME_ADDR   = "0xd34701b11cc1476C90C7b80aE84F7EFCFeaf8C5b";
const UPGRADE_ADDR  = "0xf6BDD19B73dCFB8d1BAb4C393e4CE7fd63166aDC";
const CORE_PROXY    = "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";
const DEPLOY_BLOCK  = 151879381;
const CHUNK         = 5000;

const U_NEW_BLOCK    = process.env.U_NEW_BLOCK    ? parseInt(process.env.U_NEW_BLOCK)    : undefined;
const U_NEW_TX_INDEX = process.env.U_NEW_TX_INDEX ? parseInt(process.env.U_NEW_TX_INDEX) : undefined;
const TO_BLOCK       = process.env.TO_BLOCK        ? parseInt(process.env.TO_BLOCK)       : undefined;
const DRY_RUN        = process.env.DRY_RUN === "true";

function isHistorical(blockNumber: number, txIndex: number): boolean {
  if (U_NEW_BLOCK === undefined) return true;
  if (blockNumber < U_NEW_BLOCK) return true;
  if (blockNumber === U_NEW_BLOCK) {
    if (U_NEW_TX_INDEX === undefined) return false;
    return txIndex < U_NEW_TX_INDEX;
  }
  return false;
}

async function queryRange(
  contract: ethers.Contract,
  filter: any,
  from: number,
  to: number
): Promise<ethers.EventLog[]> {
  const results: ethers.EventLog[] = [];
  for (let f = from; f <= to; f += CHUNK) {
    const t = Math.min(f + CHUNK - 1, to);
    const evs = await contract.queryFilter(filter, f, t) as ethers.EventLog[];
    results.push(...evs);
    if (evs.length > 0) process.stdout.write(`  [${f}-${t}] ${evs.length} events\n`);
  }
  return results;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("chainId:", network.chainId.toString());
  if (network.chainId !== 204n) throw new Error("Must run on opbnbMainnet");

  const scanTo = TO_BLOCK ?? (U_NEW_BLOCK !== undefined ? U_NEW_BLOCK : await ethers.provider.getBlockNumber());

  console.log(`Scanning blocks ${DEPLOY_BLOCK} → ${scanTo}`);
  if (U_NEW_BLOCK !== undefined) {
    console.log(`U_NEW_BLOCK: ${U_NEW_BLOCK} | U_NEW_TX_INDEX: ${U_NEW_TX_INDEX ?? "undefined"}`);
  }

  const incomeContract = new ethers.Contract(INCOME_ADDR, [
    "event DirectPayout(uint256 indexed userId, uint256 amount, uint256 xSlot)",
    "event EscrowReleased(uint256 indexed userId, uint256 amount)",
    "event StrandedEscrowReleased(uint256 indexed userId, uint256 pkgLevel, uint256 amount)",
    "event RebirthEscrowReleased(uint256 indexed userId, uint256 amount)",
    "event AdminEscrowReleased(uint256 indexed userId, uint256 amount)",
    "event AdminDirectPayoutExecuted(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount, uint8 cyclePkgLevel)",
  ], ethers.provider);

  const upgradeContract = new ethers.Contract(UPGRADE_ADDR, [
    "event MaxLevelEscrowReleased(uint256 indexed userId, uint256 amount)",
  ], ethers.provider);

  const coreContract = new ethers.Contract(CORE_PROXY, [
    "event UserRegistered(uint256 indexed userId, uint256 indexed sponsorId, address indexed account, uint8 packageLevel, uint256 packageAmount, uint256 placedUnderId, bool placedLeft)",
  ], ethers.provider);

  // Historical user set from registration events
  const historicalUsers = new Map<number, boolean>();

  console.log("\n[0] UserRegistered (registration boundary)...");
  const regEvents = await queryRange(coreContract, coreContract.filters.UserRegistered(), DEPLOY_BLOCK, scanTo);
  for (const e of regEvents) {
    const log = e as ethers.EventLog;
    // Get transactionIndex — available on EventLog in ethers v6
    // Falls back to receipt if not directly available
    let txIndex: number;
    if (typeof (log as any).transactionIndex === 'number') {
      txIndex = (log as any).transactionIndex;
    } else {
      const rec = await ethers.provider.getTransactionReceipt(log.transactionHash);
      txIndex = rec!.index;
    }
    const userId = Number(log.args.userId);
    const hist = isHistorical(log.blockNumber, txIndex);
    historicalUsers.set(userId, hist);
  }
  console.log(`  ${historicalUsers.size} total users, ${[...historicalUsers.values()].filter(Boolean).length} historical`);

  const qualifying = new Map<number, bigint>();
  const addQ = (userId: number, amount: bigint, block: number, txIndex: number) => {
    if (!isHistorical(block, txIndex)) return;
    qualifying.set(userId, (qualifying.get(userId) ?? 0n) + amount);
  };

  // Helper to get txIndex from EventLog
  async function getTxIndex(log: ethers.EventLog): Promise<number> {
    if (typeof (log as any).transactionIndex === 'number') return (log as any).transactionIndex;
    const rec = await ethers.provider.getTransactionReceipt(log.transactionHash);
    return rec!.index;
  }

  console.log("[1] DirectPayout...");
  for (const e of await queryRange(incomeContract, incomeContract.filters.DirectPayout(), DEPLOY_BLOCK, scanTo)) {
    const log = e as ethers.EventLog;
    addQ(Number(log.args.userId), log.args.amount as bigint, log.blockNumber, await getTxIndex(log));
  }

  console.log("[2] EscrowReleased...");
  for (const e of await queryRange(incomeContract, incomeContract.filters.EscrowReleased(), DEPLOY_BLOCK, scanTo)) {
    const log = e as ethers.EventLog;
    addQ(Number(log.args.userId), log.args.amount as bigint, log.blockNumber, await getTxIndex(log));
  }

  console.log("[3] StrandedEscrowReleased...");
  for (const e of await queryRange(incomeContract, incomeContract.filters.StrandedEscrowReleased(), DEPLOY_BLOCK, scanTo)) {
    const log = e as ethers.EventLog;
    addQ(Number(log.args.userId), log.args.amount as bigint, log.blockNumber, await getTxIndex(log));
  }

  console.log("[4] RebirthEscrowReleased...");
  for (const e of await queryRange(incomeContract, incomeContract.filters.RebirthEscrowReleased(), DEPLOY_BLOCK, scanTo)) {
    const log = e as ethers.EventLog;
    addQ(Number(log.args.userId), log.args.amount as bigint, log.blockNumber, await getTxIndex(log));
  }

  console.log("[5] AdminEscrowReleased...");
  for (const e of await queryRange(incomeContract, incomeContract.filters.AdminEscrowReleased(), DEPLOY_BLOCK, scanTo)) {
    const log = e as ethers.EventLog;
    addQ(Number(log.args.userId), log.args.amount as bigint, log.blockNumber, await getTxIndex(log));
  }

  console.log("[6] AdminDirectPayoutExecuted...");
  for (const e of await queryRange(incomeContract, incomeContract.filters.AdminDirectPayoutExecuted(), DEPLOY_BLOCK, scanTo)) {
    const log = e as ethers.EventLog;
    addQ(Number(log.args.toUserId), log.args.amount as bigint, log.blockNumber, await getTxIndex(log));
  }

  console.log("[7] MaxLevelEscrowReleased...");
  for (const e of await queryRange(upgradeContract, upgradeContract.filters.MaxLevelEscrowReleased(), DEPLOY_BLOCK, scanTo)) {
    const log = e as ethers.EventLog;
    addQ(Number(log.args.userId), log.args.amount as bigint, log.blockNumber, await getTxIndex(log));
  }

  // Build output — include ALL historical users (even zero income)
  const historicalUserIds = [...historicalUsers.entries()]
    .filter(([,hist]) => hist)
    .map(([id]) => id)
    .sort((a,b) => a-b);

  for (const userId of historicalUserIds) {
    if (!qualifying.has(userId)) qualifying.set(userId, 0n);
  }

  const entries = [...qualifying.entries()]
    .sort((a,b) => a[0]-b[0])
    .map(([userId,amount]) => ({userId:userId.toString(), historicalQualifyingIncome:amount.toString()}));

  const nonZero = entries.filter(e => e.historicalQualifyingIncome !== "0");
  const zeroIncome = entries.filter(e => e.historicalQualifyingIncome === "0");
  const totalRaw = entries.reduce((s,e) => s+BigInt(e.historicalQualifyingIncome), 0n);

  const sortedIdChecksum = ethers.keccak256(ethers.toUtf8Bytes(entries.map(e=>e.userId).join(",")));
  const idAmountChecksum = ethers.keccak256(ethers.toUtf8Bytes(entries.map(e=>`${e.userId}:${e.historicalQualifyingIncome}`).join(",")));

  // Check for duplicates
  const idSet = new Set(entries.map(e=>e.userId));
  if (idSet.size !== entries.length) throw new Error("DUPLICATE userIds in output — abort");

  const output = {
    scanMeta: {
      startBlock: DEPLOY_BLOCK,
      endBlock: scanTo,
      u_new_block: U_NEW_BLOCK ?? null,
      u_new_tx_index: U_NEW_TX_INDEX ?? null,
      scannedAt: new Date().toISOString(),
      safeForMigration: U_NEW_BLOCK !== undefined,
      sourceContracts: {incomeEngine: INCOME_ADDR, upgradeEngine: UPGRADE_ADDR, coreProxy: CORE_PROXY},
    },
    summary: {
      totalUsers: entries.length,
      nonZeroUsers: nonZero.length,
      zeroIncomeUsers: zeroIncome.length,
      totalRawQualifyingIncome: totalRaw.toString(),
      sortedUserIdChecksum: sortedIdChecksum,
      idAmountChecksum: idAmountChecksum,
    },
    users: entries,
  };

  console.log("\n=== SCAN SUMMARY ===");
  console.log("Total historical users:      ", entries.length);
  console.log("Non-zero income users:       ", nonZero.length);
  console.log("Zero-income users:           ", zeroIncome.length);
  console.log("Total raw qualifying income: ", totalRaw.toString());
  console.log("sortedUserIdChecksum:        ", sortedIdChecksum);
  console.log("idAmountChecksum:            ", idAmountChecksum);

  if (!DRY_RUN) {
    const outPath = `contracts/migration-data/historical-income-${scanTo}.json`;
    if (!fs.existsSync("contracts/migration-data")) fs.mkdirSync("contracts/migration-data",{recursive:true});
    fs.writeFileSync(outPath, JSON.stringify(output,null,2));
    console.log("Output written:", outPath);
  }
}
main().catch(e=>{console.error("FATAL:",e.message);process.exit(1);});
