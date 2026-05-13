import * as hre from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config();

const { ethers } = hre as any;

function upsertEnvValue(filePath: string, key: string, value: string) {
  const line = `${key}=${value}`;
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const matcher = new RegExp(`^${key}=.*$`, "m");
  const next = matcher.test(existing)
    ? existing.replace(matcher, line)
    : `${existing.trimEnd()}\n${line}\n`;

  fs.writeFileSync(filePath, next.startsWith("\n") ? next.slice(1) : next);
}

async function main() {
  const systemAddress = process.env.SYSTEM_PROXY || process.env.SYSTEM_PROXY_ADDRESS;
  if (!systemAddress) {
    throw new Error("SYSTEM_PROXY not set");
  }

  const wallet = ethers.Wallet.createRandom();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("NEW PLACEMENT SIGNER GENERATED");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Address    :", wallet.address);
  console.log("PrivateKey :", wallet.privateKey);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const contractsEnvPath = path.resolve(__dirname, "..", ".env");
  upsertEnvValue(contractsEnvPath, "LOCAL_PLACEMENT_SIGNER_KEY", wallet.privateKey);
  upsertEnvValue(contractsEnvPath, "PLACEMENT_SIGNER_PRIVATE_KEY", wallet.privateKey);
  upsertEnvValue(contractsEnvPath, "PLACEMENT_SIGNER_ADDRESS", wallet.address);
  console.log("contracts/.env updated ✅");

  const webEnvPath = path.resolve(__dirname, "..", "..", "apps", "web", ".env.local");
  upsertEnvValue(webEnvPath, "LOCAL_PLACEMENT_SIGNER_KEY", wallet.privateKey);
  upsertEnvValue(webEnvPath, "VITE_LOCAL_PLACEMENT_SIGNER_KEY", wallet.privateKey);
  console.log("apps/web/.env.local updated ✅");

  const signerEnvPath = path.resolve(__dirname, "..", "..", "apps", "signer", ".env");
  if (fs.existsSync(signerEnvPath)) {
    upsertEnvValue(signerEnvPath, "SIGNER_PRIVATE_KEY", wallet.privateKey);
    console.log("apps/signer/.env updated ✅");
  }

  const [deployer] = await ethers.getSigners();
  const system = await ethers.getContractAt("MetaGuildXSystem", systemAddress);

  console.log("\nUpdating placement signer on-chain...");
  const tx = await system.connect(deployer).setPlacementSigner(wallet.address);
  const receipt = await tx.wait();
  console.log("Placement signer set on-chain ✅");
  console.log("TX hash     :", tx.hash);

  const placementSignerSetTopic = system.interface.getEvent("PlacementSignerSet").topicHash;
  const eventLog = receipt?.logs.find((log: { topics?: string[] }) => log.topics?.[0] === placementSignerSetTopic);

  if (!eventLog) {
    throw new Error("PlacementSignerSet event not found in receipt");
  }

  const parsed = system.interface.parseLog(eventLog);
  const onChainSigner = parsed?.args?.placementSignerAddress as string | undefined;
  console.log("Event signer:", onChainSigner || "(missing)");
  console.log(
    "Match       :",
    onChainSigner && onChainSigner.toLowerCase() === wallet.address.toLowerCase() ? "✅" : "❌"
  );

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("DONE - New signer configured");
  console.log("Address :", wallet.address);
  console.log("Next    : run register-root.ts");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
