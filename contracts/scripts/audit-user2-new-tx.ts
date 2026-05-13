import { ethers } from "hardhat";

async function main() {
  const CORE = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const ROUTER = "0x6AD732D64727A749Df3959A6DA12066b4ab664Bb";
  const INCOME = "0xE54abA50Fa9A22F408C215B8D391B2810A4b46bE";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );

  const txHash = "0xd3acbe37e819704372812eea1ab3ec5dabc84a0324c9b17070d36f7c641c68af";
  console.log("User#2 tx:", txHash);

  const receipt = await ethers.provider.getTransactionReceipt(txHash);

  console.log("\n=== ALL EVENTS IN ORDER ===");
  for (const log of receipt!.logs) {
    for (const [name, iface] of [
      ["CORE", core.interface],
      ["ROUTER", router.interface],
      ["INCOME", income.interface],
    ] as [string, any][]) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          console.log(
            `[${name}] ${parsed.name}:`,
            JSON.stringify(
              Object.fromEntries(
                parsed.fragment.inputs.map((inp: any, i: number) => [
                  inp.name || i,
                  typeof parsed.args[i] === "bigint" ? parsed.args[i].toString() : parsed.args[i],
                ])
              )
            )
          );
          break;
        }
      } catch {}
    }
  }

  const coreBal = await usdt.balanceOf(CORE);
  const routerBal = await usdt.balanceOf(ROUTER);
  console.log("\nCore USDT  :", ethers.formatUnits(coreBal, 18));
  console.log("Router USDT:", ethers.formatUnits(routerBal, 18));

  const failed2 = await core.failedDistribution(2);
  const failedIds = await core.getFailedUserIds();
  console.log("failedDistribution[2]:", failed2);
  console.log("failedUserIds:", failedIds.toString());
}

main().catch(console.error);
