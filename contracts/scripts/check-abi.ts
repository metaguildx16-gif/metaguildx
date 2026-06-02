import { ethers } from "hardhat";
async function main() {
  const incomeArtifact = await import("../artifacts/src/MetaGuildXIncome.sol/MetaGuildXIncome.json", { assert: { type: "json" } });
  const fns = incomeArtifact.default.abi.filter((x: any) => x.type === "function").map((x: any) => x.name);
  console.log("Income functions:", fns.join(", "));
}
main().catch(console.error);
