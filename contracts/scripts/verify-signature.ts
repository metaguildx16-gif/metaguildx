import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS || process.env.SYSTEM_PROXY;
  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

  if (!CORE) {
    throw new Error("Missing SYSTEM_PROXY_ADDRESS or SYSTEM_PROXY");
  }
  if (!SIGNER_KEY) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY");
  }

  const signerWallet = new ethers.Wallet(SIGNER_KEY);
  const account = "0x2E431597752f7580B4C40165040f3C60BC0d56aD";
  const sponsorId = 4n;
  const nonce = 0n;
  const chainId = 5611n;
  const contractAddress = CORE;

  const hash1 = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [chainId, contractAddress, account, sponsorId, nonce]
  );
  const sig1 = await signerWallet.signMessage(ethers.getBytes(hash1));
  console.log("Method 1 signature:", sig1);

  const core = await ethers.getContractAt(
    [
      "function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable",
      "function nonces(address) view returns (uint256)"
    ],
    CORE
  );

  const nonceOnChain = await core.nonces(account);
  console.log("On-chain nonce for account:", nonceOnChain.toString());

  try {
    await core.registerWithPlacement.staticCall(
      sponsorId,
      19n,
      false,
      sig1,
      nonce,
      { from: account }
    );
    console.log("Method 1: PASS ✅");
  } catch (e: any) {
    console.log("Method 1 REVERT:", e.reason ?? e.message);
  }

  const hash2 = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256"],
    [chainId, contractAddress, account, sponsorId, 19n, false, nonce]
  );
  const sig2 = await signerWallet.signMessage(ethers.getBytes(hash2));

  try {
    await core.registerWithPlacement.staticCall(
      sponsorId,
      19n,
      false,
      sig2,
      nonce,
      { from: account }
    );
    console.log("Method 2: PASS ✅");
  } catch (e: any) {
    console.log("Method 2 REVERT:", e.reason ?? e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
