import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const CORE_PROXY = process.env.CORE_PROXY_ADDRESS ?? "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";
  const EXPECTED_CURRENT_IMPL =
    process.env.EXPECTED_CORE_IMPL ?? "0x064c4ebe7cb88cad6b6e2da1d7eb6d95f68d976c";
  const EXPECTED_OWNER =
    process.env.EXPECTED_CORE_OWNER ?? "0x6D01d1E9771193467B5fae47Ce8463d7060098eA";

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Network chainId:", network.chainId.toString());
  console.log("Implementation deployer:", deployer.address);
  console.log("Core proxy:", CORE_PROXY);

  if (network.chainId !== 204n) {
    throw new Error("Refusing to prepare mainnet Core upgrade on non-opBNB-mainnet chain");
  }

  const currentImpl = await upgrades.erc1967.getImplementationAddress(CORE_PROXY);
  console.log("Current implementation:", currentImpl);
  if (currentImpl.toLowerCase() !== EXPECTED_CURRENT_IMPL.toLowerCase()) {
    throw new Error(`Implementation mismatch. Expected ${EXPECTED_CURRENT_IMPL}, got ${currentImpl}`);
  }

  const ownerAbi = ["function owner() view returns (address)"];
  const coreOwnerView = await ethers.getContractAt(ownerAbi, CORE_PROXY);
  const owner = await coreOwnerView.owner();
  console.log("Core owner:", owner);
  if (owner.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) {
    throw new Error(`Owner mismatch. Expected ${EXPECTED_OWNER}, got ${owner}`);
  }

  console.log("\nDeploying linked libraries...");
  const paymentLib = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
  await paymentLib.waitForDeployment();
  const paymentLibAddress = await paymentLib.getAddress();
  console.log("MetaGuildXPaymentLib:", paymentLibAddress);

  const placementLib = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
  await placementLib.waitForDeployment();
  const placementLibAddress = await placementLib.getAddress();
  console.log("MetaGuildXPlacementLib:", placementLibAddress);

  const upgradeCycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
  await upgradeCycleLib.waitForDeployment();
  const upgradeCycleLibAddress = await upgradeCycleLib.getAddress();
  console.log("UpgradeCycleLib:", upgradeCycleLibAddress);

  const rebirthLib = await (await ethers.getContractFactory("MetaGuildXRebirthLib")).deploy();
  await rebirthLib.waitForDeployment();
  const rebirthLibAddress = await rebirthLib.getAddress();
  console.log("MetaGuildXRebirthLib:", rebirthLibAddress);

  const CoreFactory = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      MetaGuildXPaymentLib: paymentLibAddress,
      MetaGuildXPlacementLib: placementLibAddress,
      UpgradeCycleLib: upgradeCycleLibAddress,
      MetaGuildXRebirthLib: rebirthLibAddress,
    },
  });
  const linkedLibraryOptions = {
    kind: "uups",
    redeployImplementation: "always",
    unsafeAllowLinkedLibraries: true,
  } as any;

  console.log("\nPreparing new MetaGuildXCore implementation...");
  await upgrades.forceImport(CORE_PROXY, CoreFactory, linkedLibraryOptions);
  const newImplementation = (await upgrades.prepareUpgrade(CORE_PROXY, CoreFactory, linkedLibraryOptions)) as string;

  console.log("New implementation:", newImplementation);

  const upgradeInterface = new ethers.Interface([
    "function upgradeToAndCall(address newImplementation, bytes data) payable",
  ]);
  const safeCalldata = upgradeInterface.encodeFunctionData("upgradeToAndCall", [
    newImplementation,
    "0x",
  ]);

  console.log("\n=== Submit this transaction from Gnosis Safe ===");
  console.log("To:   ", CORE_PROXY);
  console.log("Value:", "0");
  console.log("Data: ", safeCalldata);
  console.log("\nAfter Safe execution, verify implementation:");
  console.log(`npx hardhat run contracts/scripts/check-core-impl.ts --network opbnbMainnet`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
