import { ethers } from "hardhat";

const CORE_PROXY    = "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B";
const INCOME_PROXY  = "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB";
const ROUTER_PROXY  = "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8";
const UPGRADE_PROXY = "0x8CF75a78641a0e390C0101a1541Bed82E3214A9A";
const USDT          = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

const CORE_ABI = [
  "function users(uint32) view returns (uint32 userId, uint32 sponsorId, uint32 placementParentId, uint8 placementSide, uint32 rebirthId, bool active)",
  "function nextUserId() view returns (uint32)",
];

const INCOME_ABI = [
  "function rebirthEscrow(uint32) view returns (uint256)",
  "function upgradeEscrow(uint32) view returns (uint256)",
  "function getTotalAllIncome(uint32) view returns (uint256)",
];

const UPGRADE_ABI = [
  "function getRebirthIds(uint32) view returns (uint32[])",
  "function getUserXSlot(uint32) view returns (uint8)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

const ROUTER_ABI = [
  "event DirectIncomeRecorded(uint32 indexed fromUserId, uint32 indexed toUserId, uint256 amount)",
  "event LevelIncomeRecorded(uint32 indexed fromUserId, uint32 indexed toUserId, uint8 level, uint256 amount)",
];

const INCOME_EVENTS_ABI = [
  "event RebirthEscrowAdded(uint32 indexed userId, uint256 amount)",
  "event RebirthEscrowReleased(uint32 indexed userId, uint256 amount)",
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

  console.log("=== REBIRTH ESCROW LEAK AUDIT ===");
  console.log("Block range:", FROM_BLOCK, "→", TO_BLOCK, "\n");

  // 1. User #1 state
  const user1 = await core.users(1);
  console.log("--- User #1 State ---");
  console.log("  rebirthId:", user1.rebirthId.toString());
  console.log("  active:", user1.active);

  // 2. Escrow balances
  const rebirthEsc = await income.rebirthEscrow(1);
  const upgradeEsc = await income.upgradeEscrow(1);
  console.log("\n--- Escrow Values ---");
  console.log("  rebirthEscrow[1]:", ethers.formatUnits(rebirthEsc, 18), "(raw:", rebirthEsc.toString(), ")");
  console.log("  upgradeEscrow[1]:", ethers.formatUnits(upgradeEsc, 18));

  // 3. Total income
  try {
    const total = await income.getTotalAllIncome(1);
    console.log("  getTotalAllIncome(1):", ethers.formatUnits(total, 18));
  } catch(e: any) {
    console.log("  getTotalAllIncome(1) ERROR:", e.message);
  }

  // 4. Contract USDT balances
  console.log("\n--- Contract USDT Balances ---");
  const coreBal   = await usdt.balanceOf(CORE_PROXY);
  const incomeBal = await usdt.balanceOf(INCOME_PROXY);
  const routerBal = await usdt.balanceOf(ROUTER_PROXY);
  console.log("  Core:", ethers.formatUnits(coreBal, 18));
  console.log("  Income:", ethers.formatUnits(incomeBal, 18));
  console.log("  Router:", ethers.formatUnits(routerBal, 18));

  // 5. All Direct income TO user #1
  console.log("\n--- Direct Income → User #1 ---");
  const directFilter = router.filters.DirectIncomeRecorded(null, 1);
  const directEvents = await router.queryFilter(directFilter, FROM_BLOCK, TO_BLOCK);
  let directTotal = 0n;
  for (const e of directEvents) {
    const ev = e as any;
    console.log("  from:", ev.args[0].toString(), "amount:", ethers.formatUnits(ev.args[2], 18));
    directTotal += ev.args[2];
  }
  console.log("  TOTAL Direct:", ethers.formatUnits(directTotal, 18));

  // 6. All Level income TO user #1
  console.log("\n--- Level Income → User #1 ---");
  const levelFilter = router.filters.LevelIncomeRecorded(null, 1);
  const levelEvents = await router.queryFilter(levelFilter, FROM_BLOCK, TO_BLOCK);
  let levelTotal = 0n;
  for (const e of levelEvents) {
    const ev = e as any;
    console.log("  from:", ev.args[0].toString(), "level:", ev.args[2].toString(), "amount:", ethers.formatUnits(ev.args[3], 18));
    levelTotal += ev.args[3];
  }
  console.log("  TOTAL Level:", ethers.formatUnits(levelTotal, 18));

  // 7. RebirthEscrow events for user #1
  console.log("\n--- RebirthEscrow Events (userId=1) ---");
  try {
    const addFilter = income.filters.RebirthEscrowAdded(1);
    const addEvents = await income.queryFilter(addFilter, FROM_BLOCK, TO_BLOCK);
    let escrowAdded = 0n;
    for (const e of addEvents) {
      const ev = e as any;
      console.log("  ADDED:", ethers.formatUnits(ev.args[1], 18), "block:", e.blockNumber);
      escrowAdded += ev.args[1];
    }
    console.log("  TOTAL Escrow Added:", ethers.formatUnits(escrowAdded, 18));

    const relFilter = income.filters.RebirthEscrowReleased(1);
    const relEvents = await income.queryFilter(relFilter, FROM_BLOCK, TO_BLOCK);
    for (const e of relEvents) {
      const ev = e as any;
      console.log("  RELEASED:", ethers.formatUnits(ev.args[1], 18), "block:", e.blockNumber);
    }
  } catch(e: any) {
    console.log("  Escrow events ERROR:", e.message);
    console.log("  (Event may not exist in ABI — check Income contract)");
  }

  // 8. Summary
  const grandTotal = directTotal + levelTotal;
  console.log("\n--- SUMMARY ---");
  console.log("  Direct + Level Total:", ethers.formatUnits(grandTotal, 18), "USDT");
  console.log("  rebirthEscrow[1] now:", ethers.formatUnits(rebirthEsc, 18));
  console.log("  Expected escrow (10%):", ethers.formatUnits(grandTotal / 10n, 18));
  console.log("  Difference:", ethers.formatUnits((grandTotal / 10n) - rebirthEsc, 18), "← missing?");

  console.log("\n=== AUDIT DONE ===");
}

main().catch(console.error);
