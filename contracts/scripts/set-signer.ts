import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const NEW_SIGNER = process.env.PLACEMENT_SIGNER_ADDRESS!;

  if (!NEW_SIGNER) {
    throw new Error("PLACEMENT_SIGNER_ADDRESS not set");
  }

  console.log("Setting signer to:", NEW_SIGNER);
  const router = await ethers.getContractAt("MetaGuildXSystem", ROUTER);

  try {
    const tx = await (router as any).setPlacementSigner(NEW_SIGNER);
    await tx.wait();
    console.log("Signer set successfully ✅");
    return;
  } catch {
    try {
      const tx = await (router as any).setTrustedSigner(NEW_SIGNER);
      await tx.wait();
      console.log("Signer set successfully ✅");
    } catch (e: any) {
      console.log("Could not set signer:", e.message);
    }
  }
}

main().catch(console.error);
