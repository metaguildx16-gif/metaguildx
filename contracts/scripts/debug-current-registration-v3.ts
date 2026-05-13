import { ethers } from "hardhat";

async function main() {
  const CORE = "0x1429859428C0aBc9C2C47C8Ee9FBaf82cFA0F20f";
  const USDT = "0x82e01223d51Eb87e16A03E24687EDF0F294da6f1";
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE, deployer);
  const usdt = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    USDT,
    deployer
  );

  const account = deployer.address;
  const sponsorId = 0n;
  const nonce = await core.nonces(account);
  const nextUserId = await core.nextUserId();
  const rootUserId = await core.rootUserId();
  const paymentAsset = await core.defaultPaymentAsset();
  const unitPrice = await core.paymentAssetUnitPrice(paymentAsset);
  const packagePrices = await core.getPackagePrices();
  const packageAmount = packagePrices[0];
  const requiredSettlement = packageAmount * unitPrice;
  const balance = await usdt.balanceOf(account);
  const allowance = await usdt.allowance(account, CORE);
  const network = await ethers.provider.getNetwork();
  const digest = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [network.chainId, CORE, account, sponsorId, nonce]
  );
  const signature = await deployer.signMessage(ethers.getBytes(digest));

  console.log("account:", account);
  console.log("nextUserId:", nextUserId.toString());
  console.log("rootUserId:", rootUserId.toString());
  console.log("nonce:", nonce.toString());
  console.log("paymentAsset:", paymentAsset);
  console.log("packageAmount:", packageAmount.toString());
  console.log("unitPrice:", unitPrice.toString());
  console.log("requiredSettlement:", ethers.formatUnits(requiredSettlement, await usdt.decimals()));
  console.log("balance:", ethers.formatUnits(balance, await usdt.decimals()));
  console.log("allowance:", ethers.formatUnits(allowance, await usdt.decimals()));
  console.log("placementSigner:", await core.placementSigner());

  try {
    const tx = await core.registerWithPlacement.populateTransaction(
      sponsorId,
      0n,
      false,
      signature,
      nonce
    );

    await ethers.provider.call({
      from: account,
      to: CORE,
      data: tx.data ?? "0x"
    });
    console.log("provider.call: SUCCESS");
  } catch (error: any) {
    const revertData =
      error?.data ??
      error?.info?.error?.data ??
      error?.error?.data ??
      null;

    console.log("provider.call failed:", error?.message ?? String(error));
    console.log("revert data:", revertData);

    const erc20Errors = new ethers.Interface([
      "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
      "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
      "error ERC20InvalidSender(address sender)",
      "error ERC20InvalidReceiver(address receiver)",
      "error ERC20InvalidApprover(address approver)",
      "error ERC20InvalidSpender(address spender)"
    ]);

    if (typeof revertData === "string" && revertData !== "0x") {
      try {
        const decoded = erc20Errors.parseError(revertData);
        console.log("decoded custom error:", decoded?.name, decoded?.args);
      } catch {
        console.log("custom error decode: no match");
      }
    }
  }

  if (nextUserId === 1n && rootUserId === 0n) {
    try {
      const tx = await core.registerWithPlacement(sponsorId, 0n, false, signature, nonce, {
        gasLimit: 2_000_000n
      });
      const receipt = await tx.wait();
      console.log("register tx success:", tx.hash);
      console.log("receipt status:", receipt?.status);
      console.log("new userId:", (await core.userIdByAddress(account)).toString());
    } catch (error: any) {
      const revertData =
        error?.data ??
        error?.info?.error?.data ??
        error?.error?.data ??
        null;
      console.log("register tx failed:", error?.message ?? String(error));
      console.log("register tx revert data:", revertData);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
