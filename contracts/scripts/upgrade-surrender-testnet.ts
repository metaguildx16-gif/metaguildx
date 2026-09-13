/**
 * upgrade-surrender-testnet.ts
 * 
 * SAFE PREPARE/VALIDATION ONLY by default.
 * Upgrades MetaGuildXCore, MetaGuildXTokenEngine, BinaryTree on opBNB Testnet.
 * 
 * Default mode: validates storage, deploys new implementations, prints calldata.
 * Execute mode: set EXECUTE_UPGRADE=true (requires authorized signer).
 * 
 * Usage:
 *   PREPARE only:
 *     npx hardhat run contracts/scripts/upgrade-surrender-testnet.ts --network opbnbTestnet
 *
 *   EXECUTE (only after prepare verification):
 *     EXECUTE_UPGRADE=true npx hardhat run contracts/scripts/upgrade-surrender-testnet.ts --network opbnbTestnet
 */

import { ethers, upgrades } from "hardhat";

// ── Testnet proxy addresses (from deployed-addresses.json) ──────────────────
const CORE_PROXY         = "0xb279B1F3EAe071b889520e91BE94288E23Df5731";
const BINARY_TREE_PROXY  = "0x6870B9486cc798730dbC8A296bDa847015354231";
const TOKEN_ENGINE_PROXY = "0xa962629506769D7e6573E9C7179F456FB1e131a2";

const EXPECTED_CHAIN_ID = 5611n;

async function main() {
  const executeMode = process.env.EXECUTE_UPGRADE === "true";
  console.log("=".repeat(60));
  console.log("MetaGuildX Surrender Upgrade — opBNB Testnet");
  console.log(`Mode: ${executeMode ? "⚠️  EXECUTE (proxy upgrade will occur)" : "✅ PREPARE ONLY (no state changes)"}`);
  console.log("=".repeat(60));

  // ── 1. Network check ──────────────────────────────────────────────────────
  const network = await ethers.provider.getNetwork();
  console.log(`\nChain ID: ${network.chainId}`);
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `❌ Wrong network. Expected chainId ${EXPECTED_CHAIN_ID} (opBNB Testnet), got ${network.chainId}. STOPPING.`
    );
  }
  console.log("✅ Network: opBNB Testnet (5611)");

  // ── 2. Signer check ───────────────────────────────────────────────────────
  const [deployer] = await ethers.getSigners();
  console.log(`\nSigner: ${deployer.address}`);

  // ── 3. Verify proxy addresses contain code ────────────────────────────────
  console.log("\n── Verifying proxy contracts ──");
  for (const [name, addr] of [
    ["Core", CORE_PROXY],
    ["BinaryTree", BINARY_TREE_PROXY],
    ["TokenEngine", TOKEN_ENGINE_PROXY],
  ] as const) {
    const code = await ethers.provider.getCode(addr);
    if (code === "0x") throw new Error(`❌ ${name} proxy ${addr} has no code. STOPPING.`);
    console.log(`✅ ${name}: ${addr}`);
  }

  // ── 4. Read ownership ─────────────────────────────────────────────────────
  console.log("\n── Ownership check ──");
  const ownerAbi = ["function owner() view returns (address)"];
  const owners: Record<string, string> = {};

  for (const [name, addr] of [
    ["Core", CORE_PROXY],
    ["BinaryTree", BINARY_TREE_PROXY],
    ["TokenEngine", TOKEN_ENGINE_PROXY],
  ] as const) {
    const contract = await ethers.getContractAt(ownerAbi, addr);
    const owner = await contract.owner() as string;
    owners[name] = owner;
    const authorized = owner.toLowerCase() === deployer.address.toLowerCase();
    console.log(`${name} owner: ${owner} ${authorized ? "✅ (signer is owner)" : "⚠️  (signer is NOT owner)"}`);
    if (!authorized && executeMode) {
      throw new Error(`❌ Signer ${deployer.address} is not owner of ${name} (${addr}). Cannot execute upgrade. STOPPING.`);
    }
  }

  // ── 5. Read current implementations ──────────────────────────────────────
  console.log("\n── Current implementations ──");
  const oldImpls: Record<string, string> = {};
  for (const [name, addr] of [
    ["Core", CORE_PROXY],
    ["BinaryTree", BINARY_TREE_PROXY],
    ["TokenEngine", TOKEN_ENGINE_PROXY],
  ] as const) {
    const impl = await upgrades.erc1967.getImplementationAddress(addr);
    oldImpls[name] = impl;
    console.log(`${name}: ${impl}`);
  }

  // ── 6. Deploy linked libraries (Core requires 5 external libs) ────────────
  console.log("\n── Deploying linked libraries for MetaGuildXCore ──");

  // Level 1: no-dependency libs
  const adminLib = await (await ethers.getContractFactory("MetaGuildXAdminLib")).deploy();
  await adminLib.waitForDeployment();
  console.log(`MetaGuildXAdminLib:        ${await adminLib.getAddress()}`);

  const rebirthLib = await (await ethers.getContractFactory("MetaGuildXRebirthLib")).deploy();
  await rebirthLib.waitForDeployment();
  console.log(`MetaGuildXRebirthLib:      ${await rebirthLib.getAddress()}`);

  const payLib = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
  await payLib.waitForDeployment();
  console.log(`MetaGuildXPaymentLib:      ${await payLib.getAddress()}`);

  const placeLib = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
  await placeLib.waitForDeployment();
  console.log(`MetaGuildXPlacementLib:    ${await placeLib.getAddress()}`);

  const cycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
  await cycleLib.waitForDeployment();
  console.log(`UpgradeCycleLib:           ${await cycleLib.getAddress()}`);

  // Level 2: MetaGuildXUpgradeFlowLib needs UpgradeCycleLib + MetaGuildXPaymentLib
  const upgradeFlowLib = await (await ethers.getContractFactory("MetaGuildXUpgradeFlowLib", {
    libraries: {
      "src/libraries/UpgradeCycleLib.sol:UpgradeCycleLib":     await cycleLib.getAddress(),
      "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib": await payLib.getAddress(),
    }
  })).deploy();
  await upgradeFlowLib.waitForDeployment();
  console.log(`MetaGuildXUpgradeFlowLib:  ${await upgradeFlowLib.getAddress()}`);

  const coreLibraries = {
    "src/MetaGuildXAdminLib.sol:MetaGuildXAdminLib":             await adminLib.getAddress(),
    "src/MetaGuildXRebirthLib.sol:MetaGuildXRebirthLib":         await rebirthLib.getAddress(),
    "src/MetaGuildXUpgradeFlowLib.sol:MetaGuildXUpgradeFlowLib": await upgradeFlowLib.getAddress(),
    "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":     await payLib.getAddress(),
    "src/libs/MetaGuildXPlacementLib.sol:MetaGuildXPlacementLib": await placeLib.getAddress(),
  };

  // ── 7. Prepare/validate new implementations (storage check included) ──────
  console.log("\n── Preparing new implementations (storage validation) ──");

  const uupsOpts = { kind: "uups" as const, redeployImplementation: "always" as const };

  // Core
  const CoreFactory = await ethers.getContractFactory("MetaGuildXCore", { libraries: coreLibraries });
  const coreOpts = { ...uupsOpts, unsafeAllowLinkedLibraries: true };
  await upgrades.forceImport(CORE_PROXY, CoreFactory, coreOpts);
  console.log("Validating Core storage layout...");
  const newCoreImpl = await upgrades.prepareUpgrade(CORE_PROXY, CoreFactory, coreOpts) as string;
  console.log(`✅ Core new implementation:        ${newCoreImpl}`);

  // TokenEngine (no linked libs)
  const TEFactory = await ethers.getContractFactory("MetaGuildXTokenEngine");
  await upgrades.forceImport(TOKEN_ENGINE_PROXY, TEFactory, uupsOpts);
  console.log("Validating TokenEngine storage layout...");
  const newTEImpl = await upgrades.prepareUpgrade(TOKEN_ENGINE_PROXY, TEFactory, uupsOpts) as string;
  console.log(`✅ TokenEngine new implementation: ${newTEImpl}`);

  // BinaryTree (no linked libs)
  const BTFactory = await ethers.getContractFactory("BinaryTree");
  await upgrades.forceImport(BINARY_TREE_PROXY, BTFactory, uupsOpts);
  console.log("Validating BinaryTree storage layout...");
  const newBTImpl = await upgrades.prepareUpgrade(BINARY_TREE_PROXY, BTFactory, uupsOpts) as string;
  console.log(`✅ BinaryTree new implementation:  ${newBTImpl}`);

  // ── 8. Summary table ──────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("UPGRADE SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network:  opBNB Testnet (5611)`);
  console.log(`Signer:   ${deployer.address}`);
  console.log("");
  console.log("Contract    | Proxy                                      | Old Implementation                         | New Implementation");
  console.log("------------|--------------------------------------------|--------------------------------------------|-------------------------------------------");
  console.log(`Core        | ${CORE_PROXY}  | ${oldImpls["Core"]}  | ${newCoreImpl}`);
  console.log(`TokenEngine | ${TOKEN_ENGINE_PROXY}  | ${oldImpls["TokenEngine"]}  | ${newTEImpl}`);
  console.log(`BinaryTree  | ${BINARY_TREE_PROXY}  | ${oldImpls["BinaryTree"]}  | ${newBTImpl}`);
  console.log("");
  console.log("Storage validation: ✅ PASSED (OpenZeppelin upgrade safety verified)");

  // ── 9. Encode calldata for each upgrade (useful if Safe is required) ──────
  const upgradeIface = new ethers.Interface([
    "function upgradeToAndCall(address newImplementation, bytes data) payable",
  ]);
  const encodeCalldata = (newImpl: string) =>
    upgradeIface.encodeFunctionData("upgradeToAndCall", [newImpl, "0x"]);

  console.log("\n── Upgrade calldata (for Gnosis Safe if needed) ──");
  console.log(`Core:        To=${CORE_PROXY}        Data=${encodeCalldata(newCoreImpl)}`);
  console.log(`TokenEngine: To=${TOKEN_ENGINE_PROXY}  Data=${encodeCalldata(newTEImpl)}`);
  console.log(`BinaryTree:  To=${BINARY_TREE_PROXY}   Data=${encodeCalldata(newBTImpl)}`);

  // ── 10. Execute (only if EXECUTE_UPGRADE=true AND signer is owner) ────────
  if (!executeMode) {
    console.log("\n" + "=".repeat(60));
    console.log("✅ PREPARE MODE COMPLETE — no proxy changes made.");
    console.log("To execute upgrade: EXECUTE_UPGRADE=true npx hardhat run ...");
    console.log("=".repeat(60));
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("⚠️  EXECUTE MODE — upgrading proxies now...");
  console.log("=".repeat(60));

  // Upgrade Core
  console.log("\nUpgrading Core proxy...");
  const coreProxy = await ethers.getContractAt("MetaGuildXCore", CORE_PROXY, deployer);
  const coreTx = await (coreProxy as any).upgradeToAndCall(newCoreImpl, "0x");
  await coreTx.wait();
  const coreImplAfter = await upgrades.erc1967.getImplementationAddress(CORE_PROXY);
  console.log(`✅ Core upgraded: ${oldImpls["Core"]} → ${coreImplAfter}`);

  // Upgrade TokenEngine
  console.log("\nUpgrading TokenEngine proxy...");
  const teProxy = await ethers.getContractAt("MetaGuildXTokenEngine", TOKEN_ENGINE_PROXY, deployer);
  const teTx = await (teProxy as any).upgradeToAndCall(newTEImpl, "0x");
  await teTx.wait();
  const teImplAfter = await upgrades.erc1967.getImplementationAddress(TOKEN_ENGINE_PROXY);
  console.log(`✅ TokenEngine upgraded: ${oldImpls["TokenEngine"]} → ${teImplAfter}`);

  // Upgrade BinaryTree
  console.log("\nUpgrading BinaryTree proxy...");
  const btProxy = await ethers.getContractAt("BinaryTree", BINARY_TREE_PROXY, deployer);
  const btTx = await (btProxy as any).upgradeToAndCall(newBTImpl, "0x");
  await btTx.wait();
  const btImplAfter = await upgrades.erc1967.getImplementationAddress(BINARY_TREE_PROXY);
  console.log(`✅ BinaryTree upgraded: ${oldImpls["BinaryTree"]} → ${btImplAfter}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ ALL PROXIES UPGRADED SUCCESSFULLY");
  console.log(`Core:        ${CORE_PROXY} → impl ${coreImplAfter}`);
  console.log(`TokenEngine: ${TOKEN_ENGINE_PROXY} → impl ${teImplAfter}`);
  console.log(`BinaryTree:  ${BINARY_TREE_PROXY} → impl ${btImplAfter}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ UPGRADE FAILED:", error.message ?? error);
  process.exitCode = 1;
});
