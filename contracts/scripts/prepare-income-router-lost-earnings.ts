import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const INCOME_ROUTER_PROXY =
    process.env.INCOME_ROUTER_PROXY ??
    process.env.INCOME_ROUTER_ADDRESS ??
    "0xc2bEE78E63381b27C893DB7F85DB8f00cB84a9FC";
  const EXPECTED_CURRENT_IMPL = process.env.EXPECTED_INCOME_ROUTER_IMPL;
  const EXPECTED_OWNER = process.env.EXPECTED_INCOME_ROUTER_OWNER;

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Network chainId:", network.chainId.toString());
  console.log("Implementation deployer:", deployer.address);
  console.log("IncomeRouter proxy:", INCOME_ROUTER_PROXY);

  if (network.chainId !== 204n && network.chainId !== 5611n) {
    throw new Error("Refusing to prepare IncomeRouter upgrade outside opBNB mainnet/testnet");
  }

  const currentImpl = await upgrades.erc1967.getImplementationAddress(INCOME_ROUTER_PROXY);
  console.log("Current implementation:", currentImpl);

  if (EXPECTED_CURRENT_IMPL && currentImpl.toLowerCase() !== EXPECTED_CURRENT_IMPL.toLowerCase()) {
    throw new Error(`Implementation mismatch. Expected ${EXPECTED_CURRENT_IMPL}, got ${currentImpl}`);
  }

  if (EXPECTED_OWNER) {
    const ownerView = await ethers.getContractAt(["function owner() view returns (address)"], INCOME_ROUTER_PROXY);
    const owner = await ownerView.owner();
    console.log("IncomeRouter owner:", owner);
    if (owner.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) {
      throw new Error(`Owner mismatch. Expected ${EXPECTED_OWNER}, got ${owner}`);
    }
  }

  const IncomeRouterFactory = await ethers.getContractFactory("IncomeRouter");
  const upgradeOptions = {
    kind: "uups",
    redeployImplementation: "always",
  } as const;

  console.log("\nPreparing new IncomeRouter implementation...");
  await upgrades.forceImport(INCOME_ROUTER_PROXY, IncomeRouterFactory, upgradeOptions);
  const newImplementation = (await upgrades.prepareUpgrade(
    INCOME_ROUTER_PROXY,
    IncomeRouterFactory,
    upgradeOptions
  )) as string;

  console.log("New implementation:", newImplementation);

  const upgradeInterface = new ethers.Interface([
    "function upgradeToAndCall(address newImplementation, bytes data) payable",
  ]);
  const safeCalldata = upgradeInterface.encodeFunctionData("upgradeToAndCall", [
    newImplementation,
    "0x",
  ]);

  console.log("\n=== Submit this transaction from the proxy owner / Safe ===");
  console.log("To:   ", INCOME_ROUTER_PROXY);
  console.log("Value:", "0");
  console.log("Data: ", safeCalldata);
  console.log("\nNo storage variables were added or reordered; this upgrade only adds an event and emits.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
