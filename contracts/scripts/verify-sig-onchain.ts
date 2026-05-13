import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

  const testAccount = "0x2E431597752f7580B4C40165040f3C60BC0d56aD";
  const sponsorId = 4n;
  const nonce = 0n;
  const chainId = 5611n;

  const signerWallet = new ethers.Wallet(SIGNER_KEY);

  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [chainId, CORE, testAccount, sponsorId, nonce]
  );
  console.log("msgHash:", msgHash);

  const ethSignedHash = ethers.hashMessage(ethers.getBytes(msgHash));
  console.log("ethSignedHash:", ethSignedHash);

  const sig = await signerWallet.signMessage(ethers.getBytes(msgHash));
  console.log("signature:", sig);

  const recovered = ethers.recoverAddress(ethSignedHash, sig);
  console.log("\nRecovered signer:", recovered);
  console.log("Expected signer:", signerWallet.address);
  console.log(
    "Match:",
    recovered.toLowerCase() === signerWallet.address.toLowerCase()
  );

  console.log("\n=== Contract verification simulation ===");
  console.log("structHash (msgHash):", msgHash);
  console.log("digest (ethSignedHash):", ethSignedHash);
  console.log(
    "Recovered == placementSigner:",
    recovered.toLowerCase() === "0x8abc4ff35207a7ea76743d29ce7f3b3adda0538e"
  );

  const frontendSig =
    "0xbc58c01a3703a0530ad4d3043118fa60a98ca580f3f687d855be44f52c54afff30c4b5f90d6c5f122b398c5b57d9751b826ed6ba1206ca503b517cce548f0e741c";
  const frontendRecovered = ethers.recoverAddress(ethSignedHash, frontendSig);
  console.log("\nFrontend sig recovered:", frontendRecovered);
  console.log(
    "Frontend sig valid:",
    frontendRecovered.toLowerCase() === "0x8abc4ff35207a7ea76743d29ce7f3b3adda0538e"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
