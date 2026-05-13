import { ethers } from "hardhat";

async function main() {
  const contracts = {
    Core: "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B",
    Income: "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB",
    Upgrade: "0x8CF75a78641a0e390C0101a1541Bed82E3214A9A",
    Router: "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8",
    BinaryTree: "0x59f18c8A55e441EE86f92b76e506bac8D08E7365",
    CashbackPool: "0x3DFb28bbAF1ef2C43cE4FcAb8f6A0e4D30B831CA",
    MGXStaking: "0xFbC873Ce780384D3c9f3F306b9904CF33c3307c3",
    MGXToken: "0x35c9Ce942Bc02986f7eC7c97b2B929991A49fe5b",
    USDT: "0xF4975eB104932bDBcA491A9Cb985439eA03863e0",
  };

  console.log("=== CONTRACT CODE CHECK ===");
  for (const [name, addr] of Object.entries(contracts)) {
    const code = await ethers.provider.getCode(addr);
    console.log(`${name.padEnd(12)}: ${code !== "0x" ? "✅ LIVE" : "❌ DEAD"} — ${addr}`);
  }

  console.log("\n=== CORE STATE ===");
  const core = await ethers.getContractAt(
    "MetaGuildXCore",
    "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B"
  );

  try {
    const nextId = await core.nextUserId();
    console.log("nextUserId:", nextId.toString());
    console.log("Total users:", (Number(nextId) - 1).toString());
  } catch (e: any) {
    console.log("nextUserId error:", e.message?.slice(0, 80));
  }

  try {
    const failedIds = await core.getFailedUserIds();
    console.log("failedUserIds:", failedIds.toString() || "none");
  } catch (e: any) {
    console.log("failedUserIds error:", e.message?.slice(0, 80));
  }

  try {
    const usdt = await ethers.getContractAt(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      "0xF4975eB104932bDBcA491A9Cb985439eA03863e0"
    );
    const routerBal = await usdt.balanceOf(
      "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8"
    );
    const coreBal = await usdt.balanceOf(
      "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B"
    );
    console.log("\n=== USDT BALANCES ===");
    console.log("Core USDT  :", ethers.formatUnits(coreBal, 18));
    console.log("Router USDT:", ethers.formatUnits(routerBal, 18));
  } catch (e: any) {
    console.log("balance error:", e.message?.slice(0, 80));
  }

  console.log("\n=== WIRING CHECK ===");
  try {
    const coreRouter = await core.incomeRouterContract();
    console.log("core→router:", coreRouter);
    console.log(
      "Match:",
      coreRouter.toLowerCase() ===
        "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8".toLowerCase()
        ? "✅"
        : "❌ WRONG: " + coreRouter
    );
  } catch (e: any) {
    console.log("wiring error:", e.message?.slice(0, 80));
  }
}

main().catch(console.error);
