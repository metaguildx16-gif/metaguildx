import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;

  const block = await provider.getBlock(150874332, true);
  console.log("Block:", 150874332);
  console.log("TXs:", block?.transactions.length);

  for (const tx of block?.transactions ?? []) {
    if (typeof tx === "string") continue;
    const receipt = await provider.getTransactionReceipt(tx.hash);

    console.log("\n---");
    console.log("hash:", tx.hash);
    console.log("from:", tx.from);
    console.log("to:", tx.to);

    const selector = tx.data.substring(0, 10);
    const selectors: Record<string, string> = {
      "0xb5e40f88": "registerWithPlacement()",
      "0x095ea7b3": "approve()",
      "0xa9059cbb": "transfer()",
      "0x23b872dd": "transferFrom()",
      "0x40c10f19": "mint()"
    };
    console.log("method:", selectors[selector] ?? selector);
    console.log("status:", receipt?.status === 1 ? "SUCCESS ✅" : "FAILED ❌");
    console.log("gasUsed:", receipt?.gasUsed.toString());
    console.log("logs:", receipt?.logs.length);

    if (tx.to?.toLowerCase() === CORE.toLowerCase()) {
      console.log("→ CORE TX!");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
