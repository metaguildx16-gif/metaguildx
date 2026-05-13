import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;
  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

  const [deployer] = await ethers.getSigners();

  const testWallet = new ethers.Wallet(SIGNER_KEY, ethers.provider);
  void testWallet;

  const newUser = ethers.Wallet.createRandom().connect(ethers.provider);
  const newUserAddress = newUser.address;
  console.log("New user:", newUserAddress);

  await (await deployer.sendTransaction({
    to: newUserAddress,
    value: ethers.parseEther("0.01")
  })).wait();
  console.log("Gas funded ✅");

  const usdt = await ethers.getContractAt([
    "function mint(address to, uint256 amount) external",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], USDT, deployer);

  await (await usdt.mint(newUserAddress, ethers.parseUnits("50", 18))).wait();
  console.log("USDT minted ✅");

  const usdtAsUser = usdt.connect(newUser);
  await (await usdtAsUser.approve(CORE, ethers.parseUnits("50", 18))).wait();
  console.log("USDT approved ✅");

  const core = await ethers.getContractAt([
    "function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable",
    "function nonces(address) view returns (uint256)",
    "function nextUserId() view returns (uint256)"
  ], CORE);

  const nonce = await core.nonces(newUserAddress);
  const chainId = 5611n;
  const contractAddress = CORE;
  const sponsorId = 4n;
  const placementParentId = 19n;
  const isLeft = false;

  const signerWallet = new ethers.Wallet(SIGNER_KEY);
  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [chainId, contractAddress, newUserAddress, sponsorId, nonce]
  );
  const signature = await signerWallet.signMessage(ethers.getBytes(msgHash));
  console.log("Signed ✅");
  console.log("Signer:", signerWallet.address);

  const coreAsUser = core.connect(newUser);

  try {
    const tx = await coreAsUser.registerWithPlacement(
      sponsorId,
      placementParentId,
      isLeft,
      signature,
      nonce,
      { gasLimit: 5_000_000n }
    );
    const receipt = await tx.wait();
    console.log("Registration SUCCESS! ✅");
    console.log("TX:", receipt?.hash);
  } catch (err: any) {
    console.log("REVERT:", err.message);
    console.log("Reason:", err.reason ?? "none");
    console.log("Data:", err.data ?? "none");

    if (err.data && err.data !== "none") {
      try {
        const iface = new ethers.Interface([
          "error Error(string)"
        ]);
        const decoded = iface.parseError(err.data);
        console.log("Decoded error:", decoded);
      } catch {}
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
