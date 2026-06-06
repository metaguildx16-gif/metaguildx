import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with:", deployer.address);

  const CASHBACK_PROXY = "0xfA98cee4B1bFBf609A55Bc3e5B4ef511D3Df0423";

  const Factory = await ethers.getContractFactory("CashbackPool");
  console.log("Deploying new CashbackPool implementation...");
  const newImpl = await Factory.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New impl deployed:", newImplAddress);

  const proxy = await ethers.getContractAt("CashbackPool", CASHBACK_PROXY, deployer);
  console.log("Calling upgradeToAndCall...");
  const tx = await proxy.upgradeToAndCall(newImplAddress, "0x");
  await tx.wait();

  console.log("CashbackPool upgraded to:", newImplAddress);
}

main().catch((e) => { console.error(e); process.exit(1); });
