import { ethers } from "hardhat";

async function main() {
  const MOCK_USDT = "0x9FD1B3670693bEDb515305F3e3c1Dbc0c342B502";
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const INCOME = "0x03dB566EF538b4264f841644B702585427f7Cd66";
  const CASHBACK = "0xDa478bBdcFFE06110BeE4292b15B12626E52354b";
  const USER2 = "0x768ABB0cb74DFE05e8B81919595D9366370053a0";

  const usdt = await ethers.getContractAt("MockUSDT", MOCK_USDT);
  const provider = ethers.provider;
  const erc20Iface = new ethers.Interface([
    "function transferFrom(address from, address to, uint256 amount) returns (bool)"
  ]);
  const incomeIface = new ethers.Interface([
    "function distributeJoinIncome(uint256 fromUserId, uint256 sponsorId, uint256 businessAmount, address paymentAsset)"
  ]);

  console.log("=== PAYMENT SIMULATION ===");
  try {
    await provider.call({
      from: ROUTER
      ,
      to: MOCK_USDT,
      data: erc20Iface.encodeFunctionData("transferFrom", [
        USER2,
        ROUTER,
        ethers.parseUnits("10", 18)
      ])
    });
    console.log("transferFrom simulation: SUCCESS ✅");
  } catch (e: any) {
    const revertData = e?.data ?? e?.info?.error?.data ?? e?.error?.data ?? null;
    console.log("transferFrom FAIL:", e.message.slice(0, 150));
    console.log("transferFrom revert data:", revertData);
  }

  console.log("\n=== INCOME ROUTER STATE ===");
  try {
    const income = await ethers.getContractAt(
      [
        "function coreContract() view returns (address)",
        "function distributeJoinIncome(uint256,uint256,uint256,address)"
      ],
      INCOME
    );
    const core = await income.coreContract();
    console.log("IncomeRouter core:", core);
    console.log("Matches Router?  :", core.toLowerCase() === ROUTER.toLowerCase());
  } catch (e: any) {
    console.log("IncomeRouter check failed:", e.message.slice(0, 100));
  }

  console.log("\n=== CASHBACK POOL STATE ===");
  try {
    const cashback = await ethers.getContractAt(["function coreContract() view returns (address)"], CASHBACK);
    const core = await cashback.coreContract();
    console.log("CashbackPool core:", core);
    console.log("Matches Router?  :", core.toLowerCase() === ROUTER.toLowerCase());
  } catch (e: any) {
    console.log("CashbackPool check failed:", e.message.slice(0, 100));
  }

  console.log("\n=== INCOME ROUTER FUNCTIONS ===");
  try {
    await provider.call({
      from: ROUTER
      ,
      to: INCOME,
      data: incomeIface.encodeFunctionData("distributeJoinIncome", [
        2n,
        1n,
        100n,
        MOCK_USDT
      ])
    });
    console.log("distributeJoinIncome staticCall: SUCCESS ✅");
  } catch (e: any) {
    const revertData = e?.data ?? e?.info?.error?.data ?? e?.error?.data ?? null;
    console.log("distributeJoinIncome FAIL:", e.message.slice(0, 150));
    console.log("distributeJoinIncome revert data:", revertData);
  }

  console.log("\n=== SYNC CHECK ===");
  const router = await ethers.getContractAt("MetaGuildXSystem", ROUTER);
  try {
    const incomeAddr = await router.incomeContract();
    const cashbackAddr = await router.cashbackContract();
    console.log("Router incomeContract  :", incomeAddr);
    console.log("Router cashbackContract:", cashbackAddr);
  } catch (e: any) {
    console.log("Router state check failed:", e.message);
  }
}

main().catch(console.error);
