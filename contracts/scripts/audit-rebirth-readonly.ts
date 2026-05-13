import { ethers } from "hardhat";

const CORE_PROXY    = "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B";
const INCOME_PROXY  = "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB";
const UPGRADE_PROXY = "0x8CF75a78641a0e390C0101a1541Bed82E3214A9A";
const ROUTER_PROXY  = "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8";
const USDT          = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

const CORE_ABI = [
  "function nextUserId() view returns (uint256)",
  "function getUserOriginalPackageLevel(uint256) view returns (uint8)",
  "function getUserPackageLevel(uint256) view returns (uint256)",
  "function getUserWallet(uint256) view returns (address)",
  "function getUserSponsorId(uint256) view returns (uint256)",
  "function getPackagePriceByLevel(uint256) view returns (uint256)",
  "function usersById(uint256) view returns (uint256,address,uint256,uint8,uint8,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
];

const INCOME_ABI = [
  "function rebirthEscrow(uint256) view returns (uint256)",
  "function getRebirthEscrow(uint256) view returns (uint256)",
  "function upgradeEscrow(uint256, uint256) view returns (uint256)",
  "function getTotalAllIncome(uint256) view returns (uint256)",
];

const UPGRADE_ABI = [
  "function getRebirthIds(uint256) view returns (uint256[])",
  "function getUserXSlot(uint256) view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

const ROUTER_ABI = [
  "event DirectIncomeRecorded(uint32 indexed fromUserId, uint32 indexed toUserId, uint256 amount)",
  "event LevelIncomeRecorded(uint32 indexed fromUserId, uint32 indexed toUserId, uint8 level, uint256 amount)",
];

const INCOME_EVENTS_ABI = [
  "event EscrowCredited(uint256 indexed userId, uint256 amount, uint256 xSlot)",
  "event DirectPayout(uint256 indexed userId, uint256 amount, uint256 xSlot)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://opbnb-testnet-rpc.bnbchain.org");

  const core    = new ethers.Contract(CORE_PROXY, CORE_ABI, provider);
  const income  = new ethers.Contract(INCOME_PROXY, [...INCOME_ABI, ...INCOME_EVENTS_ABI], provider);
  const upgrade = new ethers.Contract(UPGRADE_PROXY, UPGRADE_ABI, provider);
  const usdt    = new ethers.Contract(USDT, ERC20_ABI, provider);
  const router  = new ethers.Contract(ROUTER_PROXY, ROUTER_ABI, provider);

  const FROM_BLOCK = 149800000;
  const TO_BLOCK   = await provider.getBlockNumber();
  const CHUNK      = 49000;

  console.log("=== READ-ONLY REBIRTH AUDIT ===");
  console.log("Blocks:", FROM_BLOCK, "→", TO_BLOCK);

  // 1. Basic user #1 info
  console.log("\n--- User #1 Basic Info ---");
  try {
    const raw = await core.usersById(1);
    console.log("  id:", raw[0].toString());
    console.log("  account:", raw[1]);
    console.log("  sponsorId:", raw[2].toString());
    console.log("  packageLevel:", raw[3].toString());
    console.log("  originalPackageLevel:", raw[4].toString());
    console.log("  rebirthCount:", raw[9].toString());
    console.log("  xCount:", raw[10].toString());
    console.log("  surrendered:", raw[12]);
  } catch(e: any) { console.log("  usersById ERROR:", e.message.slice(0,100)); }

  // 2. Package price level 1
  console.log("\n--- Package Price ---");
  try {
    const price = await core.getPackagePriceByLevel(1);
    console.log("  getPackagePriceByLevel(1) raw:", price.toString());
    console.log("  formatted (÷1e18):", ethers.formatUnits(price, 18));
  } catch(e: any) { console.log("  getPackagePriceByLevel ERROR:", e.message.slice(0,100)); }

  // 3. Rebirth IDs for user #1
  console.log("\n--- Rebirth State ---");
  try {
    const ids = await upgrade.getRebirthIds(1);
    console.log("  getRebirthIds(1):", ids.map((x: any) => x.toString()));
    console.log("  length:", ids.length, "← if > 0, escrow stops accumulating!");
  } catch(e: any) { console.log("  getRebirthIds ERROR:", e.message.slice(0,100)); }

  try {
    const xslot = await upgrade.getUserXSlot(1);
    console.log("  getUserXSlot(1):", xslot.toString());
  } catch(e: any) { console.log("  getUserXSlot ERROR:", e.message.slice(0,100)); }

  // 4. Escrow values
  console.log("\n--- Escrow Values ---");
  try {
    const re = await income.getRebirthEscrow(1);
    console.log("  getRebirthEscrow(1) raw:", re.toString());
    console.log("  formatted:", ethers.formatUnits(re, 18));
  } catch(e: any) {
    try {
      const re2 = await income.rebirthEscrow(1);
      console.log("  rebirthEscrow(1) raw:", re2.toString());
      console.log("  formatted:", ethers.formatUnits(re2, 18));
    } catch(e2: any) { console.log("  rebirthEscrow ERROR:", e2.message.slice(0,100)); }
  }

  // 5. USDT balances
  console.log("\n--- USDT Balances ---");
  const coreBal   = await usdt.balanceOf(CORE_PROXY);
  const incomeBal = await usdt.balanceOf(INCOME_PROXY);
  const routerBal = await usdt.balanceOf(ROUTER_PROXY);
  console.log("  Core:", ethers.formatUnits(coreBal, 18));
  console.log("  Income:", ethers.formatUnits(incomeBal, 18));
  console.log("  Router:", ethers.formatUnits(routerBal, 18));

  // 6. EscrowCredited events for user #1 (read-only)
  console.log("\n--- EscrowCredited Events → User #1 ---");
  try {
    let escrowTotal = 0n;
    for (let s = FROM_BLOCK; s <= TO_BLOCK; s += CHUNK) {
      const e2 = Math.min(s + CHUNK - 1, TO_BLOCK);
      const evs = await income.queryFilter(income.filters.EscrowCredited(1), s, e2);
      for (const ev of evs) {
        const a = ev as any;
        console.log("  block:", ev.blockNumber, "amount:", ethers.formatUnits(a.args[1], 18), "xSlot:", a.args[2].toString());
        escrowTotal += a.args[1];
      }
    }
    console.log("  TOTAL EscrowCredited:", ethers.formatUnits(escrowTotal, 18));
  } catch(e: any) { console.log("  EscrowCredited ERROR:", e.message.slice(0,100)); }

  // 7. DirectPayout events for user #1 (read-only)
  console.log("\n--- DirectPayout Events → User #1 ---");
  try {
    let payoutTotal = 0n;
    for (let s = FROM_BLOCK; s <= TO_BLOCK; s += CHUNK) {
      const e2 = Math.min(s + CHUNK - 1, TO_BLOCK);
      const evs = await income.queryFilter(income.filters.DirectPayout(1), s, e2);
      for (const ev of evs) {
        const a = ev as any;
        console.log("  block:", ev.blockNumber, "amount:", ethers.formatUnits(a.args[1], 18), "xSlot:", a.args[2].toString());
        payoutTotal += a.args[1];
      }
    }
    console.log("  TOTAL DirectPayout:", ethers.formatUnits(payoutTotal, 18));
  } catch(e: any) { console.log("  DirectPayout ERROR:", e.message.slice(0,100)); }

  // 8. Direct income TO user #1 from router
  console.log("\n--- Router Direct Income → User #1 ---");
  try {
    let directTotal = 0n;
    for (let s = FROM_BLOCK; s <= TO_BLOCK; s += CHUNK) {
      const e2 = Math.min(s + CHUNK - 1, TO_BLOCK);
      const evs = await router.queryFilter(router.filters.DirectIncomeRecorded(null, 1), s, e2);
      for (const ev of evs) {
        const a = ev as any;
        console.log("  from:", a.args[0].toString(), "amount:", ethers.formatUnits(a.args[2], 18));
        directTotal += a.args[2];
      }
    }
    console.log("  TOTAL Direct:", ethers.formatUnits(directTotal, 18));
  } catch(e: any) { console.log("  Direct ERROR:", e.message.slice(0,100)); }

  // 9. Level income TO user #1 from router
  console.log("\n--- Router Level Income → User #1 ---");
  try {
    let levelTotal = 0n;
    for (let s = FROM_BLOCK; s <= TO_BLOCK; s += CHUNK) {
      const e2 = Math.min(s + CHUNK - 1, TO_BLOCK);
      const evs = await router.queryFilter(router.filters.LevelIncomeRecorded(null, 1), s, e2);
      for (const ev of evs) {
        const a = ev as any;
        console.log("  from:", a.args[0].toString(), "level:", a.args[2].toString(), "amount:", ethers.formatUnits(a.args[3], 18));
        levelTotal += a.args[3];
      }
    }
    console.log("  TOTAL Level:", ethers.formatUnits(levelTotal, 18));
  } catch(e: any) { console.log("  Level ERROR:", e.message.slice(0,100)); }

  console.log("\n=== AUDIT COMPLETE — NO CHANGES MADE ===");
}

main().catch(console.error);
