import path from "node:path";
import fs from "node:fs";
import { network } from "hardhat";

function main() {
  const workspaceRoot = path.resolve(__dirname, "..", "..");
  const deploymentPath = path.join(workspaceRoot, "contracts", "deployments", `${network.name}.json`);
  const frontendAbiDir = path.join(workspaceRoot, "apps", "web", "src", "generated");
  const frontendEnvPath = path.join(workspaceRoot, "apps", "web", ".env.local");

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found for network ${network.name}: ${deploymentPath}`);
  }

  const deploymentFile = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as {
    deployment: { address: string; chainId?: number };
    abi: unknown;
    contracts?: {
      metaGuildAnalytics?: { address: string };
    };
  };

  const networkKey =
    network.name === "localhost"
      ? "local"
      : network.name === "opbnbTestnet"
      ? "testnet"
      : network.name === "opbnbMainnet"
      ? "mainnet"
      : "local";

  const envPrefix =
    networkKey === "local" ? "VITE_LOCAL" : networkKey === "testnet" ? "VITE_TESTNET" : "VITE_MAINNET";

  const rpcUrl =
    network.name === "localhost"
      ? process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545"
      : network.name === "opbnbTestnet"
      ? process.env.OPBNB_TESTNET_RPC_URL || ""
      : network.name === "opbnbMainnet"
      ? process.env.OPBNB_MAINNET_RPC_URL || ""
      : "";

  const chainId =
    deploymentFile.deployment.chainId ??
    (network.name === "localhost" ? 31337 : network.name === "opbnbTestnet" ? 5611 : network.name === "opbnbMainnet" ? 204 : "");

  const envLines = [
    `VITE_NETWORK=${networkKey}`,
    `${envPrefix}_RPC_URL=${rpcUrl}`,
    `${envPrefix}_CHAIN_ID=${chainId}`,
    `${envPrefix}_CONTRACT_ADDRESS=${deploymentFile.deployment.address}`,
    `${envPrefix}_ANALYTICS_ADDRESS=${deploymentFile.contracts?.metaGuildAnalytics?.address ?? ""}`,
    `VITE_METAGUILDX_SYSTEM_ADDRESS=${deploymentFile.deployment.address}`,
    `VITE_METAGUILDX_ANALYTICS_ADDRESS=${deploymentFile.contracts?.metaGuildAnalytics?.address ?? ""}`
  ];

  fs.mkdirSync(frontendAbiDir, { recursive: true });
  fs.writeFileSync(
    path.join(frontendAbiDir, "MetaGuildXSystem.json"),
    JSON.stringify(deploymentFile.abi, null, 2)
  );
  fs.writeFileSync(frontendEnvPath, `${envLines.join("\n")}\n`);

  console.log(`Synced frontend ABI to ${frontendAbiDir}`);
  console.log(`Updated frontend env at ${frontendEnvPath}`);
}

main();
