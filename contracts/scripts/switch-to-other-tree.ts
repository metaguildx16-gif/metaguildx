import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const OTHER_TREE = "0x59f18c8A55e441EE86f92b76e506bac8D08E7365";
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE, deployer);

  console.log("Switching to OTHER tree...");
  await (await core.setBinaryTreeContract(OTHER_TREE)).wait();
  console.log("BinaryTree → OTHER ✅");

  const tree = await core.binaryTreeContract();
  console.log("Verified:", tree);
  console.log("Match:", tree.toLowerCase() === OTHER_TREE.toLowerCase());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
