import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.MOCK_USDT_ADDRESS!;

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const signerWallet = new ethers.Wallet(
    process.env.PLACEMENT_SIGNER_PRIVATE_KEY!,
    ethers.provider
  );
  const onChainSigner = await core.placementSigner();
  console.log("Signer wallet:", signerWallet.address);
  console.log("On-chain signer:", onChainSigner);
  console.log(
    "Match:",
    signerWallet.address.toLowerCase() === onChainSigner.toLowerCase()
  );

  const nextId = await core.nextUserId();
  if (nextId > 1n) {
    const failed = await core.failedDistribution(1n);
    if (!failed) {
      console.log("Root already registered and clean");
      return;
    }
  }

  const nonce = await core.nonces(deployer.address);
  const chainId = 5611n;
  const contractAddr = CORE;

  const hash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [chainId, contractAddr, deployer.address, 0n, nonce]
  );
  const sig = await signerWallet.signMessage(ethers.getBytes(hash));

  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );
  const packageAmount = await core.getPackagePriceByLevel(1n);
  const unitPrice = await core.paymentAssetUnitPrice(USDT);
  const settlementAmount = packageAmount * unitPrice;
  console.log("Package amount:", packageAmount.toString());
  console.log("Settlement amount:", ethers.formatEther(settlementAmount));

  console.log("Approving USDT...");
  const approveTx = await usdt.approve(CORE, settlementAmount);
  await approveTx.wait();
  console.log("USDT approved");

  const nextUserId = await core.nextUserId();
  if (nextUserId <= 1n) {
    console.log("Registering root user...");
    const regTx = await core.registerWithPlacement(0n, 0n, true, sig, nonce);
    await regTx.wait();
    console.log("Root registered");
  } else {
    console.log("Root already exists, skipping...");
  }

  const failed = await core.failedDistribution(1n);
  if (failed) {
    console.log("failedDistribution[1] true, retrying...");
    const retryTx = await core.adminRetryDistribution(1n);
    await retryTx.wait();
    console.log("Retry TX:", retryTx.hash);
  }

  const coreBal = await usdt.balanceOf(CORE);
  const creator = await core.creatorFeeWallet();
  const creatorBal = await usdt.balanceOf(creator);

  console.log("Core USDT:", ethers.formatEther(coreBal));
  console.log("Creator USDT:", ethers.formatEther(creatorBal));
  console.log("failedDistribution[1]:", await core.failedDistribution(1n));
}

main().catch(console.error);
