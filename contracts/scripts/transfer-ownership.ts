import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

type DeployedAddresses = {
  Core: string;
  Income: string;
  Router: string;
  BinaryTree: string;
  Upgrade: string;
  CashbackPool: string;
  MGXStaking: string;
  MGXToken: string;
  TokenEngine: string;
  USDT: string;
  deployBlock: number;
};

type OwnershipTarget = {
  label: string;
  address: string;
};

const ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");
const SAFE_OWNER = "0x6D01d1E9771193467B5fae47Ce8463d7060098eA";
const EXPECTED_DEPLOYER = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

function loadAddresses(): DeployedAddresses {
  if (!fs.existsSync(ADDRESSES_PATH)) {
    throw new Error(`Missing deployed-addresses.json at ${ADDRESSES_PATH}`);
  }

  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as DeployedAddresses;
}

async function main() {
  console.log("=== MetaGuildX V3 Ownership Transfer ===\n");
  console.log("Safety note:");
  console.log("- After running this script, all admin functions require Gnosis Safe multisig approval.");
  console.log("- 2 of 3 signers must approve each transaction.");
  console.log("- Test on testnet first before mainnet.\n");

  const deployed = loadAddresses();
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log(`Current signer: ${deployerAddress}`);
  console.log(`Expected deployer: ${EXPECTED_DEPLOYER}`);
  console.log(`New owner (Safe): ${SAFE_OWNER}\n`);

  const ownableAbi = [
    "function owner() view returns (address)",
    "function transferOwnership(address newOwner) external"
  ] as const;

  const targets: OwnershipTarget[] = [
    { label: "MetaGuildXCore", address: deployed.Core },
    { label: "MetaGuildXIncome", address: deployed.Income },
    { label: "MetaGuildXUpgrade", address: deployed.Upgrade },
    { label: "MGXStaking", address: deployed.MGXStaking },
    { label: "MGXToken", address: deployed.MGXToken },
    { label: "MetaGuildXTokenEngine", address: deployed.TokenEngine }
  ];

  let transferred = 0;
  let failed = 0;
  let skipped = 0;

  for (const target of targets) {
    console.log(`--- ${target.label} ---`);

    try {
      const contract = new ethers.Contract(target.address, ownableAbi, deployer);
      const currentOwner = String(await contract.owner());

      console.log(`Address: ${target.address}`);
      console.log(`Current owner: ${currentOwner}`);

      if (currentOwner.toLowerCase() !== deployerAddress.toLowerCase()) {
        console.log(`⚠️  Skipped: current owner is not the connected deployer signer.`);
        skipped++;
        console.log("");
        continue;
      }

      if (deployerAddress.toLowerCase() !== EXPECTED_DEPLOYER.toLowerCase()) {
        console.log(`⚠️  Warning: signer does not match the expected deployer address, but owner check passed.`);
      }

      const tx = await contract.transferOwnership(SAFE_OWNER);
      console.log(`Transfer tx: ${tx.hash}`);
      await tx.wait();

      const newOwner = String(await contract.owner());
      if (newOwner.toLowerCase() === SAFE_OWNER.toLowerCase()) {
        console.log(`✅ Ownership transferred to ${SAFE_OWNER}`);
        transferred++;
      } else {
        console.log(`❌ Transfer verification failed. Owner is still ${newOwner}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ Transfer failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }

    console.log("");
  }

  console.log("=== Ownership Transfer Summary ===");
  console.log(`Transferred: ${transferred}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
