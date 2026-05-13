import { ethers } from "hardhat";

async function main() {
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const INCOME = "0x03dB566EF538b4264f841644B702585427f7Cd66";
  const MOCK_USDT = "0x9FD1B3670693bEDb515305F3e3c1Dbc0c342B502";
  const USER1 = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
  const USER2 = "0x768ABB0cb74DFE05e8B81919595D9366370053a0";

  const [deployer] = await ethers.getSigners();
  const router = await ethers.getContractAt("MetaGuildXSystem", ROUTER);
  const usdt = await ethers.getContractAt("MockUSDT", MOCK_USDT);

  console.log("=== INCOME ROUTER STATE ===");
  const income = await ethers.getContractAt("IncomeRouter", INCOME);

  const incomeBal = await usdt.balanceOf(INCOME);
  console.log("IncomeRouter USDT:", ethers.formatUnits(incomeBal, 18));

  const routerBal = await usdt.balanceOf(ROUTER);
  console.log("Router USDT:", ethers.formatUnits(routerBal, 18));

  const user1 = await router.usersById(1);
  console.log("\n=== SPONSOR (USER1) STATE ===");
  console.log("User1 packageLevel:", user1.packageLevel.toString());
  console.log("User1 account:", user1.account);
  console.log("User1 totalEarnings:", user1.totalEarnings.toString());

  try {
    const sponsorPkg = await (income as any).getUserPackageLevel(ROUTER, 1n);
    console.log("IncomeRouter User1 pkg:", sponsorPkg.toString());
  } catch (e: any) {
    console.log("getUserPackageLevel ERR:", e.message.slice(0, 100));
  }

  try {
    const directPct = await (income as any).directIncomePercent();
    console.log("directIncomePercent:", directPct.toString());
  } catch {
    console.log("directIncomePercent: not readable");
  }

  try {
    const levelPcts = await (income as any).getLevelIncomePercents();
    console.log("levelIncomePercents:", levelPcts.map((v: bigint) => v.toString()));
  } catch {
    console.log("levelIncomePercents: not readable");
  }

  try {
    const upgMgr = await (router as any).upgradeManagerContract();
    console.log("\nupgradeManager:", upgMgr);
  } catch {
    console.log("upgradeManager: not readable");
  }

  console.log("\n=== ETH_CALL SIMULATION ===");
  try {
    const iface = (await ethers.getContractAt("IncomeRouter", INCOME)).interface;
    const calldata = iface.encodeFunctionData("distributeJoinIncome", [
      2n,
      1n,
      100n,
      MOCK_USDT
    ]);
    const result = await ethers.provider.send("eth_call", [{
      from: ROUTER,
      to: INCOME,
      data: calldata,
      gas: "0x1E8480"
    }, "latest"]);
    console.log("distributeJoinIncome eth_call: SUCCESS", result);
  } catch (e: any) {
    console.log("distributeJoinIncome FAIL:", e.message.slice(0, 300));
    if (e.data) {
      console.log("error data:", e.data);
    }

    try {
      const errorData = e.data;
      if (errorData && errorData !== "0x") {
        const selector = errorData.slice(0, 10);
        console.log("error selector:", selector);

        const known: Record<string, string> = {
          "0x30dfbbeb": "InvalidPlacementSignature()",
          "0x82b42900": "Unauthorized()",
          "0x8e4a2337": "OnlyCore()",
          "0x443c2f47": "InvalidAmount()",
          "0x1b6f19a8": "TransferFailed()"
        };
        console.log("decoded error:", known[selector] ?? "unknown — add to list");
      }
    } catch {}
  }

  console.log("\n=== REAL TX DEBUG ===");
  const incomeWriter = income.connect(deployer);
  try {
    const tx = await (incomeWriter as any).distributeJoinIncome(2n, 1n, 100n, MOCK_USDT, {
      gasLimit: 500_000n
    });
    const receipt = await tx.wait();
    console.log("TX SUCCESS - logs:", receipt?.logs.length ?? 0);

    for (const log of receipt?.logs ?? []) {
      try {
        const parsed = income.interface.parseLog(log);
        if (parsed?.name === "DebugStep") {
          console.log("DEBUG:", parsed.args.step, "=", parsed.args.value.toString());
        }
      } catch {}
    }
  } catch (e: any) {
    console.log("TX failed at:", e.message.slice(0, 200));
    if (e.receipt) {
      console.log("Partial logs:", e.receipt.logs?.length ?? 0);
      for (const log of e.receipt.logs ?? []) {
        try {
          const parsed = income.interface.parseLog(log);
          if (parsed?.name === "DebugStep") {
            console.log("DEBUG:", parsed.args.step, "=", parsed.args.value.toString());
          }
        } catch {}
      }
    }
  }
}

main().catch(console.error);
