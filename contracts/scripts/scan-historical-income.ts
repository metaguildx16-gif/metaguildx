/**
 * scan-historical-income.ts
 *
 * Production READ-ONLY historical qualifying income scanner.
 *
 * Reconstructs totalLifetimeQualifyingIncome per userId from OLD production
 * events for the period BEFORE the Net-Surrender Core upgrade (U_NEW).
 *
 * QualifyingIncomePaid event did NOT exist before U_NEW — old events are used.
 *
 * ZERO transactions. ZERO state changes.
 *
 * Usage:
 *   npx hardhat run scripts/scan-historical-income.ts \
 *     --network opbnbMainnet \
 *     -- --to-block 185083128
 *
 *   Optional: -- --from-block 151879381 (default = DEPLOYMENT_BLOCK)
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Production addresses (from apps/web/.env) ─────────────────────────────
const CORE_ADDR    = "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";
const INCOME_ADDR  = "0xd34701b11cc1476C90C7b80aE84F7EFCFeaf8C5b";
const UPGRADE_ADDR = "0xf6BDD19B73dCFB8d1BAb4C393e4CE7fd63166aDC";
const DEPLOYMENT_BLOCK = 151879381;
const MAX_CHUNK = 5000;
const UNIT_PRICE = 100000000000000000n; // 1e17 — 1 platform unit = $0.10 USDT

// ── Event topics (ethers.id precomputed) ───────────────────────────────────
const TOPICS = {
  DirectPayout:            "0x015507fa36a008654614a733337634bc3ce7cc9b2d20ef17fc60f4442831f75d",
  EscrowReleased:          "0x10ce17ae7e78eb775b13182ea618b201c2c81afc8fee55c287291f8686f17eac",
  StrandedEscrowReleased:  "0xc71e2df904aa4db2507f12cbb04e041bcb71e6b925267d1ae6c94318ed410677",
  RebirthEscrowReleased:   "0x360bad11fb3d48eacc4106be9974c9defd65cad822cfbb183b4b1b0cd16c4395",
  AdminEscrowReleased:     "0x6ec901ce491ef2fc976794cb85ea156475958cdaef6e4b1c36471f8358f3ebb1",
  MaxLevelEscrowReleased:  "0xe1d254cee732e5ccd91cd878efeda6396cf7f8610856f802e6bf5a10329af4d2",
  PackageUpgraded:         "0x226bdbdab08a43c6df721812155c4a13766fce283488affcafa3725018845589",
  RebirthCreated:          "0x3e7465c28b616f127bdf0318a3f460ca27a9ebcfa4c310a5abe82440080cbf84",
};

// ── Decoders: returns {userId, amount} in PLATFORM UNITS ──────────────────
// All events: userId = indexed topic[1], amount = non-indexed data or topic
// DirectPayout(uint256 indexed userId, uint256 amount, uint256 xSlot)
//   topics[1]=userId, data=abi.encode(amount, xSlot) → amount at bytes 0-32
// EscrowReleased(uint256 indexed userId, uint256 amount)
//   topics[1]=userId, data=abi.encode(amount)
// StrandedEscrowReleased(uint256 indexed userId, uint256 pkgLevel, uint256 amount)
//   topics[1]=userId, data=abi.encode(pkgLevel, amount) → amount at bytes 32-64
// RebirthEscrowReleased(uint256 indexed userId, uint256 amount) — same as EscrowReleased
// AdminEscrowReleased(uint256 indexed userId, uint256 amount) — same
// MaxLevelEscrowReleased(uint256 indexed userId, uint256 amount) — same
// PackageUpgraded(uint256 indexed userId, uint256 newLevel) — no amount
// RebirthCreated(uint256 indexed userId, uint256 indexed newId) — no amount

type RawLog = {
  topics: string[];
  data: string;
  transactionHash: string;
  blockNumber: string;
  transactionIndex: string;
  logIndex: string;
  address: string;
};

type ParsedEvent = {
  eventName: string;
  userId: bigint;
  amount: bigint;
  txHash: string;
  blockNumber: number;
  txIndex: number;
  logIndex: number;
  contract: string;
};

function decodeLog(log: RawLog, eventName: string): ParsedEvent {
  const userId = BigInt(log.topics[1]);
  let amount = 0n;
  const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;

  switch (eventName) {
    case "DirectPayout":
      // data = abi.encode(uint256 amount, uint256 xSlot) → first 32 bytes = amount
      amount = data.length >= 64 ? BigInt("0x" + data.slice(0, 64)) : 0n;
      break;
    case "StrandedEscrowReleased":
      // data = abi.encode(uint256 pkgLevel, uint256 amount) → bytes 32-64 = amount
      amount = data.length >= 128 ? BigInt("0x" + data.slice(64, 128)) : 0n;
      break;
    case "EscrowReleased":
    case "RebirthEscrowReleased":
    case "AdminEscrowReleased":
    case "MaxLevelEscrowReleased":
      // data = abi.encode(uint256 amount)
      amount = data.length >= 64 ? BigInt("0x" + data.slice(0, 64)) : 0n;
      break;
    case "PackageUpgraded":
    case "RebirthCreated":
      amount = 0n; // not a payout event
      break;
  }
  return {
    eventName,
    userId,
    amount,
    txHash: log.transactionHash,
    blockNumber: parseInt(log.blockNumber, 16),
    txIndex: parseInt(log.transactionIndex, 16),
    logIndex: parseInt(log.logIndex, 16),
    contract: log.address.toLowerCase(),
  };
}

function displayUSDT(platformRaw: bigint): string {
  const usdt = Number(platformRaw) * Number(UNIT_PRICE) / 1e18;
  return usdt.toFixed(2);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getLogs(
  provider: ethers.JsonRpcProvider,
  address: string,
  topic: string,
  fromBlock: number,
  toBlock: number
): Promise<RawLog[]> {
  const fh = "0x" + fromBlock.toString(16);
  const th = "0x" + toBlock.toString(16);
  let retries = 0;
  while (true) {
    try {
      const result = await provider.send("eth_getLogs", [{
        fromBlock: fh, toBlock: th, address, topics: [topic]
      }]);
      await sleep(300);
      return result as RawLog[];
    } catch (e: any) {
      retries++;
      if (retries > 15) throw new Error(`Too many retries at ${fromBlock}-${toBlock}: ${e.message}`);
      process.stdout.write(`r${retries}`);
      await sleep(2000 * Math.min(retries, 5));
    }
  }
}

async function scanEvent(
  provider: ethers.JsonRpcProvider,
  address: string,
  topic: string,
  eventName: string,
  fromBlock: number,
  toBlock: number
): Promise<{ events: ParsedEvent[]; retries: number; chunks: number }> {
  const events: ParsedEvent[] = [];
  let retries = 0;
  let chunks = 0;

  for (let f = fromBlock; f <= toBlock; f += MAX_CHUNK) {
    const t = Math.min(f + MAX_CHUNK - 1, toBlock);
    const raw = await getLogs(provider, address, topic, f, t);
    for (const log of raw) {
      events.push(decodeLog(log, eventName));
    }
    chunks++;
    const pct = Math.round((f - fromBlock) / (toBlock - fromBlock) * 100);
    if (chunks % 100 === 0) process.stdout.write(`${pct}% `);
  }
  return { events, retries, chunks };
}

async function main() {
  // ── Parse CLI args via env vars ──────────────────────────────────────────
  // Usage: TO_BLOCK=185083128 npx hardhat run scripts/scan-historical-income.ts --network opbnbMainnet
  // Optional: FROM_BLOCK=151879381
  let toBlock = process.env.TO_BLOCK ? parseInt(process.env.TO_BLOCK) : -1;
  let fromBlock = process.env.FROM_BLOCK ? parseInt(process.env.FROM_BLOCK) : DEPLOYMENT_BLOCK;

  if (toBlock < 0) {
    console.error("ERROR: TO_BLOCK env var is required.");
    console.error("Usage: TO_BLOCK=185083128 npx hardhat run scripts/scan-historical-income.ts --network opbnbMainnet");
    process.exit(1);
  }
  if (fromBlock < DEPLOYMENT_BLOCK) {
    console.error(`ERROR: fromBlock ${fromBlock} < deployment block ${DEPLOYMENT_BLOCK}`);
    process.exit(1);
  }
  if (toBlock < fromBlock) {
    console.error(`ERROR: toBlock ${toBlock} < fromBlock ${fromBlock}`);
    process.exit(1);
  }

  // ── Network check ─────────────────────────────────────────────────────────
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 204n) {
    console.error(`ERROR: Must run on opBNB Mainnet (chainId 204). Got ${network.chainId}`);
    process.exit(1);
  }
  const provider = ethers.provider as unknown as ethers.JsonRpcProvider;

  console.log("═".repeat(70));
  console.log("MetaGuildX — Historical Income Scanner (READ-ONLY)");
  console.log("═".repeat(70));
  console.log(`chainId:         ${network.chainId}`);
  console.log(`fromBlock:       ${fromBlock}`);
  console.log(`toBlock:         ${toBlock}`);
  console.log(`totalBlocks:     ${toBlock - fromBlock + 1}`);
  console.log(`chunkSize:       ${MAX_CHUNK}`);
  console.log(`incomeContract:  ${INCOME_ADDR}`);
  console.log(`upgradeContract: ${UPGRADE_ADDR}`);
  console.log(`coreContract:    ${CORE_ADDR}`);
  console.log("");

  // ── nextUserId at toBlock ─────────────────────────────────────────────────
  let nextUserIdAtToBlock = "UNAVAILABLE";
  let historicalUserCount = "UNAVAILABLE";
  try {
    const coreAbi = ["function nextUserId() view returns (uint256)"];
    const core = new ethers.Contract(CORE_ADDR, coreAbi, ethers.provider);
    const nuid = await core.nextUserId() as bigint;
    nextUserIdAtToBlock = nuid.toString();
    historicalUserCount = (nuid - 1n).toString();
    console.log(`nextUserId (current, not at toBlock): ${nuid}`);
    console.log(`NOTE: opBNB RPC is not archive — historical blockTag unavailable`);
  } catch (e: any) {
    console.log(`nextUserId: unavailable (${e.message?.slice(0,50)})`);
  }

  // ── Scan all qualifying income events ─────────────────────────────────────
  const allQualifying: ParsedEvent[] = [];
  let totalRetries = 0;
  let totalChunks = 0;
  let scanErrors = 0;

  const eventScans: Array<{name: string; addr: string; topic: string}> = [
    { name: "DirectPayout",           addr: INCOME_ADDR,  topic: TOPICS.DirectPayout },
    { name: "EscrowReleased",         addr: INCOME_ADDR,  topic: TOPICS.EscrowReleased },
    { name: "StrandedEscrowReleased", addr: INCOME_ADDR,  topic: TOPICS.StrandedEscrowReleased },
    { name: "RebirthEscrowReleased",  addr: INCOME_ADDR,  topic: TOPICS.RebirthEscrowReleased },
    { name: "AdminEscrowReleased",    addr: INCOME_ADDR,  topic: TOPICS.AdminEscrowReleased },
    { name: "MaxLevelEscrowReleased", addr: UPGRADE_ADDR, topic: TOPICS.MaxLevelEscrowReleased },
  ];

  const eventTotals: Record<string, { count: number; platformRaw: bigint; display: string }> = {};

  for (const { name, addr, topic } of eventScans) {
    process.stdout.write(`\nScanning ${name}... `);
    try {
      const { events, retries, chunks } = await scanEvent(provider, addr, topic, name, fromBlock, toBlock);
      totalRetries += retries;
      totalChunks += chunks;
      for (const e of events) allQualifying.push(e);
      const total = events.reduce((a, e) => a + e.amount, 0n);
      eventTotals[name] = { count: events.length, platformRaw: total, display: displayUSDT(total) };
      console.log(`${events.length} events, ${total} raw ($${displayUSDT(total)} USDT)`);
    } catch (e: any) {
      console.error(`\nFATAL scan error for ${name}: ${e.message}`);
      scanErrors++;
    }
    await sleep(1000);
  }

  // ── Scan PackageUpgraded + RebirthCreated for remainder audit ─────────────
  console.log("\nScanning PackageUpgraded...");
  let upgradeEvents: ParsedEvent[] = [];
  let rebirthEvents: ParsedEvent[] = [];
  try {
    const { events: ue } = await scanEvent(provider, UPGRADE_ADDR, TOPICS.PackageUpgraded, "PackageUpgraded", fromBlock, toBlock);
    upgradeEvents = ue;
    console.log(`PackageUpgraded: ${ue.length} events`);
  } catch (e: any) { console.error("PackageUpgraded scan error:", e.message); scanErrors++; }
  await sleep(1000);

  console.log("Scanning RebirthCreated...");
  try {
    const { events: re } = await scanEvent(provider, UPGRADE_ADDR, TOPICS.RebirthCreated, "RebirthCreated", fromBlock, toBlock);
    rebirthEvents = re;
    console.log(`RebirthCreated: ${re.length} events`);
  } catch (e: any) { console.error("RebirthCreated scan error:", e.message); scanErrors++; }

  // ── Remainder candidate detection ─────────────────────────────────────────
  // Build index of qualifying events by txHash
  const qualByTx: Record<string, ParsedEvent[]> = {};
  for (const e of allQualifying) {
    if (!qualByTx[e.txHash]) qualByTx[e.txHash] = [];
    qualByTx[e.txHash].push(e);
  }

  // Upgrade remainder candidates: PackageUpgraded tx where remainder > 0 possible
  // Remainder = escrow - upgradeCost. Since escrow is not emitted, we check:
  // If any QUALIFYING event exists for the SAME userId in the SAME tx,
  // that is the income that triggered the upgrade — NOT a remainder.
  // An unlogged remainder has NO qualifying event for that userId in that tx.
  const unresolvedRemainderCandidates: Array<{type:string; userId:number; txHash:string; block:number; note:string}> = [];
  let reconstructedRemainder = 0n;

  for (const upg of upgradeEvents) {
    const txEvs = (qualByTx[upg.txHash] || []).filter(e => e.userId === upg.userId);
    // If any qualifying payout exists for this user in this tx, the remainder path
    // either did not trigger, or was already captured via a qualifying event.
    // We cannot prove remainder=0 without trace, but Phase 2C proved all 11 rebirths
    // and 1 upgrade had remainder=0 by receipt analysis through block 185083128.
    // Flag any NEW events beyond the known validated set.
    const isKnown =
      (upg.eventName === "PackageUpgraded" && upgradeEvents.length === 1 &&
       upg.txHash === "0x5de6ed7b7f45e8e7349f217338a2e6dd9dfaed3099a6334c4e49136e10befa8c") ||
      (upg.eventName === "RebirthCreated");
    if (!isKnown) {
      unresolvedRemainderCandidates.push({
        type: upg.eventName,
        userId: Number(upg.userId),
        txHash: upg.txHash,
        block: upg.blockNumber,
        note: "NEW event beyond validated snapshot — manual remainder analysis required",
      });
    }
  }

  // New rebirths beyond known 11
  const knownRebirthTxs = new Set([
    "0xbdf436e54bf615f70cb9c4b451f32757d1679dcea7897eb720af6f7c7ba35eee",
    "0x78dfbe595d00657d6b4baed1983a7d6b2d88e4d82a6f0c7fe959fa1d906d0c78",
    "0x7c7df5907594b789208dfef504dfb8c459033144ebf782e3f41bc11589e150a6",
    "0x32a41c5c1fdda99d75401e4c22fd651e393abed1aaffc6963fcf4813a368145c",
    "0x8bf696b8c7bddb37bfdbbae34faf63c1d6c98d489158300f77c6aebe349a81f3",
    "0x3f6db4641711fda6915938598a162f7b14a054aff9b4da66fb1d19c357c6a5a4",
    "0xcb2ba99432c0913bd1a74548dc8c6c62788a6b62e9b397213ba5288d30c4e2e7",
    "0xdae3c937e128e079145eba8ecdc3d8e95f9d8fc9dc51fc7d83dcbcf5bce425ee",
    "0x3e58a3139b97547d6d9ca2acd99617801dbb92c1c69f97163897eb5f45193567",
    "0x78098cec3930edd9c2c4d2d280378e295a9a293a3f2314903ee17794ecb84435",
  ]);
  // userId=27 and userId=25 share the same tx
  knownRebirthTxs.add("0x32a41c5c1fdda99d75401e4c22fd651e393abed1aaffc6963fcf4813a368145c");

  for (const reb of rebirthEvents) {
    if (!knownRebirthTxs.has(reb.txHash)) {
      unresolvedRemainderCandidates.push({
        type: "RebirthCreated",
        userId: Number(reb.userId),
        txHash: reb.txHash,
        block: reb.blockNumber,
        note: "NEW rebirth beyond validated snapshot — manual remainder analysis required",
      });
    }
  }

  // ── Aggregate per user ────────────────────────────────────────────────────
  const userMap: Record<number, {
    directPayout: bigint;
    escrowReleased: bigint;
    strandedEscrowReleased: bigint;
    rebirthEscrowReleased: bigint;
    adminEscrowReleased: bigint;
    maxLevelEscrowReleased: bigint;
    unloggedRemainder: bigint;
    total: bigint;
  }> = {};

  const addUser = (userId: number) => {
    if (!userMap[userId]) userMap[userId] = {
      directPayout: 0n, escrowReleased: 0n, strandedEscrowReleased: 0n,
      rebirthEscrowReleased: 0n, adminEscrowReleased: 0n, maxLevelEscrowReleased: 0n,
      unloggedRemainder: 0n, total: 0n,
    };
  };

  for (const e of allQualifying) {
    const uid = Number(e.userId);
    addUser(uid);
    switch (e.eventName) {
      case "DirectPayout":           userMap[uid].directPayout           += e.amount; break;
      case "EscrowReleased":         userMap[uid].escrowReleased         += e.amount; break;
      case "StrandedEscrowReleased": userMap[uid].strandedEscrowReleased += e.amount; break;
      case "RebirthEscrowReleased":  userMap[uid].rebirthEscrowReleased  += e.amount; break;
      case "AdminEscrowReleased":    userMap[uid].adminEscrowReleased    += e.amount; break;
      case "MaxLevelEscrowReleased": userMap[uid].maxLevelEscrowReleased += e.amount; break;
    }
    userMap[uid].total += e.amount;
  }

  // ── Compute totals ────────────────────────────────────────────────────────
  const grandTotalFromEvents = Object.values(eventTotals).reduce((a, v) => a + v.platformRaw, 0n);
  const grandTotalFromUsers  = Object.values(userMap).reduce((a, v) => a + v.total, 0n);
  const totalIncludedEvents  = Object.values(eventTotals).reduce((a, v) => a + v.count, 0);
  const usersWithIncome      = Object.values(userMap).filter(v => v.total > 0n).length;

  // ── Reconciliation check ──────────────────────────────────────────────────
  const reconciled = grandTotalFromEvents === grandTotalFromUsers;

  // ── Canonical checksum ────────────────────────────────────────────────────
  // Preimage: chainId|fromBlock|toBlock|uid:total|uid:total|... (sorted by uid)
  const sortedUsers = Object.entries(userMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const checksumPreimage = [
    `chainId:${network.chainId}`,
    `fromBlock:${fromBlock}`,
    `toBlock:${toBlock}`,
    ...sortedUsers.map(([uid, v]) => `${uid}:${v.total}`),
  ].join("|");
  const canonicalChecksum = ethers.keccak256(ethers.toUtf8Bytes(checksumPreimage));

  // Legacy checksum (from /tmp scan-remaining.js): ethers.keccak256(ethers.toUtf8Bytes(grandTotal + usersCount))
  const legacyChecksum = ethers.keccak256(
    ethers.toUtf8Bytes(grandTotalFromEvents.toString() + usersWithIncome)
  );

  const knownLegacyChecksum = "0xa8f716839d2c02418369a43ee7ad0cfcfb68b537e728ed3e3224ba5c717b53c8";

  // ── Safety determination ──────────────────────────────────────────────────
  const safeForMigration =
    scanErrors === 0 &&
    reconciled &&
    unresolvedRemainderCandidates.length === 0;

  // ── Build output ──────────────────────────────────────────────────────────
  const users = sortedUsers.map(([uid, v]) => ({
    userId: Number(uid),
    directPayout: v.directPayout.toString(),
    escrowReleased: v.escrowReleased.toString(),
    strandedEscrowReleased: v.strandedEscrowReleased.toString(),
    rebirthEscrowReleased: v.rebirthEscrowReleased.toString(),
    adminEscrowReleased: v.adminEscrowReleased.toString(),
    maxLevelEscrowReleased: v.maxLevelEscrowReleased.toString(),
    unloggedRemainder: v.unloggedRemainder.toString(),
    totalHistoricalQualifyingIncome: v.total.toString(),
    totalUSDT: displayUSDT(v.total),
  }));

  const output = {
    _note: "Historical qualifying income. Re-run with toBlock=U_NEW-1 before migration. ZERO transactions.",
    chainId: network.chainId.toString(),
    deploymentBlock: DEPLOYMENT_BLOCK,
    fromBlock,
    toBlock,
    generatedAt: new Date().toISOString(),
    coreAddress: CORE_ADDR,
    incomeAddress: INCOME_ADDR,
    upgradeAddress: UPGRADE_ADDR,
    nextUserIdAtToBlock,
    historicalUserCount,
    eventTotals: Object.fromEntries(
      Object.entries(eventTotals).map(([k, v]) => [k, {
        count: v.count,
        platformRaw: v.platformRaw.toString(),
        display: `$${v.display} USDT`,
      }])
    ),
    upgradeRebirthAudit: {
      packageUpgradedCount: upgradeEvents.length,
      rebirthCreatedCount: rebirthEvents.length,
      unresolvedRemainderCandidates,
      reconstructedRemainderPlatformRaw: reconstructedRemainder.toString(),
    },
    users,
    grandTotalPlatformRaw: grandTotalFromEvents.toString(),
    grandTotalDisplay: `$${displayUSDT(grandTotalFromEvents)} USDT`,
    usersWithNonZeroIncome: usersWithIncome,
    totalIncludedEvents,
    reconciliation: {
      grandTotalFromEvents: grandTotalFromEvents.toString(),
      grandTotalFromUsers:  grandTotalFromUsers.toString(),
      match: reconciled,
    },
    legacyChecksum,
    legacyChecksumKnown: knownLegacyChecksum,
    legacyChecksumMatch: legacyChecksum === knownLegacyChecksum,
    canonicalChecksum,
    canonicalChecksumPreimage: `chainId|fromBlock|toBlock|<uid:total sorted>`,
    scanStats: { totalChunks, totalRetries, scanErrors },
    safeForMigration,
  };

  // ── Write output ──────────────────────────────────────────────────────────
  const outDir = path.join(__dirname, "../migration-data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `historical-income-${toBlock}.json`);
  if (fs.existsSync(outFile)) {
    console.error(`\nERROR: Output file already exists: ${outFile}`);
    console.error("Delete it manually if you want to rescan.");
    process.exit(1);
  }
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));

  // ── Final report ──────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("SCAN RESULTS");
  console.log("═".repeat(70));
  for (const [k, v] of Object.entries(eventTotals)) {
    console.log(`  ${k.padEnd(26)}: ${String(v.count).padStart(4)} events  ${v.platformRaw.toString().padStart(10)} raw  ($${v.display} USDT)`);
  }
  console.log(`  ${"─".repeat(65)}`);
  console.log(`  ${"TOTAL".padEnd(26)}: ${String(totalIncludedEvents).padStart(4)} events  ${grandTotalFromEvents.toString().padStart(10)} raw  ($${displayUSDT(grandTotalFromEvents)} USDT)`);
  console.log(`\nUsers with non-zero income: ${usersWithIncome}`);
  console.log(`Reconciliation (events=users total): ${reconciled ? "✅ MATCH" : "❌ MISMATCH"}`);
  console.log(`\nLegacy checksum:    ${legacyChecksum}`);
  console.log(`Known reference:    ${knownLegacyChecksum}`);
  console.log(`Legacy match:       ${legacyChecksum === knownLegacyChecksum ? "✅" : "❌"}`);
  console.log(`\nCanonical checksum: ${canonicalChecksum}`);
  console.log(`\nUpgrade/rebirth remainder candidates: ${unresolvedRemainderCandidates.length}`);
  if (unresolvedRemainderCandidates.length > 0) {
    for (const c of unresolvedRemainderCandidates) console.log(`  ⚠️  ${c.type} userId=${c.userId} tx=${c.txHash} — ${c.note}`);
  }
  console.log(`\nScan errors: ${scanErrors}, Retries: ${totalRetries}`);
  console.log(`\nOutput: ${outFile}`);
  console.log("\n" + "═".repeat(70));
  if (safeForMigration) {
    console.log("✅ SAFE FOR MIGRATION");
  } else {
    console.log("❌ NOT SAFE FOR MIGRATION");
    console.log("   Reasons:");
    if (!reconciled) console.log("   - Reconciliation failed");
    if (scanErrors > 0) console.log(`   - ${scanErrors} scan errors`);
    if (unresolvedRemainderCandidates.length > 0)
      console.log(`   - ${unresolvedRemainderCandidates.length} unresolved remainder candidate(s)`);
  }
  console.log("═".repeat(70));

  if (!safeForMigration) process.exit(1);
}

main().catch(e => {
  console.error("\nFATAL:", e.message ?? e);
  process.exit(1);
});
