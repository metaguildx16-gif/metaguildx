import { ethers } from "hardhat";

async function main() {
  const errors = [
    "InvalidSigner()",
    "InvalidUnitPrice()",
    "NativeAssetMustBeZero()",
    "AlreadyRegistered()",
    "PlacementSignerNotSet()",
    "InvalidNonce()",
    "RootSponsorMustBeZero()",
    "InvalidRootPlacement()",
    "SponsorNotFound()",
    "NativePaymentDisabled()",
    "Unauthorized()",
    "UserNotFound()",
    "UpgradeOnlyToNextLevel()",
    "CashbackContractNotSet()",
    "AlreadySurrendered()",
    "SurrenderLocked()",
    "SurrenderExpired()",
    "NoCashback()",
    "AmountMustBePositive()",
    "InsufficientBalance()",
    "RootCannotReenter()",
    "ReentryNotAvailable()",
    "IncomeContractNotSet()",
    "StakingContractNotSet()",
    "InvalidStakingDuration()",
    "InvalidUser()",
    "CommunityAllocationExceeded()",
    "InvalidPlacementParent()",
    "PlacementParentNotFound()",
    "PlacementSlotOccupied()",
    "InvalidBoxPrice()",
    "NoTokensAvailableInCurrentBox()",
    "InvalidNativePayment()",
    "UnexpectedNativePayment()",
    "InvalidRecipient()",
    "InsufficientNativeLiquidity()",
    "NativePayoutFailed()",
    "InvalidPaymentAsset()",
    "InsufficientPlatformAssetBalance()",
    "InvalidContract()",
    "TargetNotContract()",
    "PaymentAssetDisabled()",
    "PaymentAssetNotConfigured()",
    "InvalidPlacementSignature()",
    "InvalidSignatureLength()",
    "InvalidSignatureV()",
    "InvalidSignature()",
    "ReentrancyGuardReentrantCall()"
  ];

  const target = "0x30dfbbeb";

  for (const err of errors) {
    const selector = ethers.id(err).slice(0, 10);
    if (selector === target) {
      console.log("MATCH FOUND:", err, "=", selector);
    } else {
      console.log(err, "=", selector);
    }
  }
}

main().catch(console.error);
