import { ethers } from "hardhat";

async function main() {
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const router = await ethers.getContractAt("MetaGuildXSystem", ROUTER);

  const names = [
    "getPlacementSigner",
    "placementSigner",
    "trustedSigner",
    "systemSigner",
    "getSigner"
  ];

  for (const name of names) {
    try {
      const val = await (router as any)[name]();
      console.log(`${name}():`, val);
    } catch {
      // ignore missing method
    }
  }
}

main().catch(console.error);
