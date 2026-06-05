import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const CORE_PROXY = "0x19F72c5a287334086fD34D41ebe6bb534524D202";
  const CORE_IMPL  = "0x760882C7210F62C12E9272080080AF7c2bA1461A";

  // Get deployed bytecode of Core impl
  const provider = ethers.provider;
  const code = await provider.getCode(CORE_IMPL);
  console.log("Core impl code length:", code.length);

  // Library addresses are embedded in bytecode
  // Check artifacts for linked library addresses
  const artifact = await import("../artifacts/src/MetaGuildXCore.sol/MetaGuildXCore.json", { assert: { type: "json" } });
  console.log("Linked libraries in artifact:");
  console.log(JSON.stringify(artifact.default.linkReferences, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
