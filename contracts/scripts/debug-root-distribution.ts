import { ethers } from "hardhat";

async function main() {
  const CORE = "0xc3c34e64E65a455B7274747C90d77680D340AE6C";
  const ROUTER = "0x18260cfDF4069ceD210B7973965C1c99800C56D5";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const provider = ethers.provider;

  try {
    const router = await ethers.getContractAt("IncomeRouter", ROUTER);

    await provider.send("hardhat_impersonateAccount", [CORE]);
    const coreSigner = await ethers.getSigner(CORE);

    const routerAsCore = router.connect(coreSigner);

    try {
      await routerAsCore.distributeJoinIncome.staticCall(
        1n,
        0n,
        0n,
        100n,
        USDT,
        0n
      );
      console.log("SUCCESS");
    } catch (e: any) {
      console.log("Error data:", e.data);
      console.log("Error reason:", e.reason);
      console.log("Error message:", e.message);

      if (e.data) {
        try {
          const decoded = ethers.toUtf8String("0x" + e.data.slice(10));
          console.log("Decoded:", decoded);
        } catch {}
      }
    }

    await provider.send("hardhat_stopImpersonatingAccount", [CORE]);
  } catch (e: any) {
    console.log("Setup error:", e.message);
  }

  console.log("\n=== Manual checks ===");

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);

  const user1 = await core.usersById(1n);
  console.log("User1 id:", user1[0].toString());
  console.log("User1 account:", user1[1]);
  console.log("User1 pkgLevel:", user1[3].toString());

  const creator = await core.creatorFeeWallet();
  console.log("Creator:", creator);

  try {
    const engine = await core.incomeEngineContract();
    console.log("Income engine:", engine);
  } catch {
    console.log("incomeEngineContract not found");
  }

  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );
  const coreBal = await usdt.balanceOf(CORE);
  console.log("Core USDT:", ethers.formatEther(coreBal));

  try {
    const routerAddr = await core.incomeRouterContract();
    console.log("Core.incomeRouterContract:", routerAddr);
    console.log("Expected ROUTER:", ROUTER);
    console.log("Match:", routerAddr.toLowerCase() === ROUTER.toLowerCase());
  } catch (e: any) {
    console.log("Router check error:", e.message);
  }
}

main().catch(console.error);
