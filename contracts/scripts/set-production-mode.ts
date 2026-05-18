import { ethers } from "hardhat";

const CORE = "0xB7607Ed884C665BE1ddE73e6D82d0ac5AD4095af";
const CORRECT_USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const core = await ethers.getContractAt("MetaGuildXCore", CORE, deployer);

  const currentMode = await core.productionMode();
  const currentAsset = await core.defaultPaymentAsset();
  console.log("Current productionMode:", currentMode);
  console.log("Current defaultPaymentAsset:", currentAsset);

  if (currentMode === true && currentAsset.toLowerCase() === CORRECT_USDT.toLowerCase()) {
    console.log("Already in production mode ✅");
    return;
  }

  console.log("Setting productionMode = true...");
  const tx = await core.setProductionMode(true, CORRECT_USDT);
  await tx.wait();
  console.log("TX:", tx.hash);

  const newMode = await core.productionMode();
  const newAsset = await core.defaultPaymentAsset();
  console.log("New productionMode:", newMode);
  console.log("New defaultPaymentAsset:", newAsset);

  if (newMode === true && newAsset.toLowerCase() === CORRECT_USDT.toLowerCase()) {
    console.log("✅ Production mode enabled!");
    console.log("Users must now pay USDT to register.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
