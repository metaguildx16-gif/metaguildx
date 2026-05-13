import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  console.log("chainId:", network.chainId.toString());
  console.log("name:", network.name);

  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
  const signerWallet = new ethers.Wallet(SIGNER_KEY);

  const testAccount = "0x2E431597752f7580B4C40165040f3C60BC0d56aD";
  const sponsorId = 4n;
  const nonce = 0n;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;

  const actualChainId = network.chainId;
  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [actualChainId, CORE, testAccount, sponsorId, nonce]
  );
  const sig = await signerWallet.signMessage(ethers.getBytes(msgHash));

  console.log("\nActual chainId:", actualChainId.toString());
  console.log("Hardcoded chainId: 5611");
  console.log("Match:", actualChainId === 5611n);
  console.log("Signature:", sig);

  const core = await ethers.getContractAt(
    [
      "function nonces(address) view returns (uint256)",
      "function placementSigner() view returns (address)",
    ],
    CORE
  );

  const onChainNonce = await core.nonces(testAccount);
  const onChainSigner = await core.placementSigner();

  console.log("\nOn-chain nonce:", onChainNonce.toString());
  console.log("On-chain signer:", onChainSigner);
  console.log("Script signer:", signerWallet.address);
  console.log(
    "Signer match:",
    onChainSigner.toLowerCase() === signerWallet.address.toLowerCase()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
