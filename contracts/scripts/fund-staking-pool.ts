import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const MGX_TOKEN = "0x19E069Af60c3ADE190057430f51A4E16f18C1377";
  const STAKING = "0xafAE38B2fAd58C92089632Fe0C97FCC33Dc6Fa07";
  const AMOUNT = ethers.parseEther("10235000");

  const mgx = await ethers.getContractAt("MGXToken", MGX_TOKEN);

  const launchMinted = await mgx.launchMinted();
  console.log("launchMinted:", launchMinted);

  if (!launchMinted) {
    console.log("Minting launch allocations...");
    await (await mgx.mintLaunchAllocations(
      deployer.address,
      deployer.address,
      deployer.address
    )).wait();
    console.log("MGX minted");
  }

  const deployerBalance = await mgx.balanceOf(deployer.address);
  console.log("Deployer MGX:", ethers.formatEther(deployerBalance));

  await (await mgx.approve(STAKING, AMOUNT)).wait();
  console.log("Approved");

  const staking = await ethers.getContractAt("MGXStaking", STAKING);
  await (await staking.adminFundStakingPool(AMOUNT)).wait();
  console.log("Pool funded");

  const pool = await staking.rewardPool();
  console.log("Reward Pool:", ethers.formatEther(pool), "MGX");

  const mgxBal = await mgx.balanceOf(STAKING);
  console.log("MGX in staking:", ethers.formatEther(mgxBal));
}

main().catch(console.error);
