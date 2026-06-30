// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IMetaGuildXTokenEngine.sol";
import "./libs/MetaGuildXPaymentLib.sol";
import "./libraries/MGXTypes.sol";
import "./libraries/UpgradeCycleLib.sol";

interface IMetaGuildXUpgradeFlowIncome {
    function getEscrow(uint256 userId) external view returns (uint256);
    function getEscrowByPkg(uint256 userId, uint8 pkgLevel) external view returns (uint256);
    function releaseEscrow(uint256 userId, uint256 amount) external;
    function releaseEscrowByPkg(uint256 userId, uint8 pkgLevel, uint256 amount) external;
    function releaseStrandedEscrow(uint256 userId, address paymentAsset) external;
}

interface IMetaGuildXUpgradeFlowRouter {
    function distributeUpgradeIncome(
        uint256 fromUserId,
        uint256 sponsorId,
        uint256 businessAmount,
        address paymentAsset
    ) external;
}

interface IMetaGuildXUpgradeFlowCashbackPool {
    function notifyCashbackAccrued(uint256 platformAmount, address paymentAsset, uint256 settlementAmount) external;
    function distribute(address paymentAsset, bool productionMode) external returns (uint256 totalAmount);
    function totalSurrenderedUsers() external view returns (uint256);
}

error UserNotFound(uint256 userId);
error Unauthorized();
error UpgradeOnlyToNextLevel();
error RebirthCannotUpgrade();
error NativePaymentDisabled();
error TokenEngineNotSet();
error PaymentAssetDisabled();
error PaymentAssetNotConfigured();
error InvalidContract();

library MetaGuildXUpgradeFlowLib {
    event PackageUpgraded(uint256 indexed userId, uint8 fromLevel, uint8 toLevel, uint256 amount);
    event PaymentCollected(address indexed payer, address indexed asset, uint256 platformAmount, uint256 settlementAmount);
    event PaymentWithdrawn(address indexed recipient, address indexed asset, uint256 platformAmount, uint256 settlementAmount);

    struct UpgradeConfig {
        address incomeEngineContract;
        address incomeRouterContract;
        address cashbackPoolContract;
        address creatorFeeWallet;
        address defaultPaymentAsset;
        address tokenEngineContract;
        address mgxTokenAddress;
        bool productionMode;
        uint256 cashbackJoinShareBps;
        uint256 creatorShareBps;
    }

    function upgradePackage(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => address) storage userPrimaryAsset,
        mapping(uint256 => bool) storage manuallyUpgraded,
        mapping(uint256 => uint8) storage activeBoxByUser,
        mapping(uint256 => uint256) storage tokenAllocationsByUser,
        mapping(uint256 => mapping(uint256 => uint256)) storage referralCountByPkg,
        mapping(address => bool) storage enabledPaymentAssets,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        uint256[] storage packagePricesArray,
        UpgradeConfig memory config,
        uint256 userId,
        uint8 newPackageLevel
    ) external returns (uint256 tokenAmount) {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.account != msg.sender) revert Unauthorized();
        if (profile.id == 0) revert UserNotFound(userId);
        if (newPackageLevel != profile.packageLevel + 1) revert UpgradeOnlyToNextLevel();
        if (profile.rebirthCount > 0) revert RebirthCannotUpgrade();

        uint256 upgradeAmount = UpgradeCycleLib.calcUpgradeCost(packagePricesArray[profile.packageLevel - 1]);
        address paymentAsset = config.defaultPaymentAsset;
        uint8 currentPkg = profile.packageLevel;
        uint256 currentPackageEscrow = IMetaGuildXUpgradeFlowIncome(config.incomeEngineContract).getEscrow(userId);
        uint256 nextPackageEscrow = IMetaGuildXUpgradeFlowIncome(config.incomeEngineContract).getEscrowByPkg(userId, currentPkg + 1);
        uint256 combinedEscrow = currentPackageEscrow + nextPackageEscrow;
        uint256 walletCharge = upgradeAmount > combinedEscrow ? upgradeAmount - combinedEscrow : 0;

        if (config.productionMode) {
            if (walletCharge > 0) {
                _collectPayment(enabledPaymentAssets, nativePaymentAssets, paymentAssetUnitPrice, paymentAsset, walletCharge);
            }
        } else {
            if (msg.value != 0) revert NativePaymentDisabled();
            paymentAsset = address(0);
        }

        uint256 escrowToUse = upgradeAmount < combinedEscrow ? upgradeAmount : combinedEscrow;

        if (currentPackageEscrow > 0 && escrowToUse > 0) {
            uint256 fromPkg1 = currentPackageEscrow >= escrowToUse ? escrowToUse : currentPackageEscrow;
            IMetaGuildXUpgradeFlowIncome(config.incomeEngineContract).releaseEscrow(userId, fromPkg1);
            escrowToUse -= fromPkg1;
        }

        if (nextPackageEscrow > 0 && escrowToUse > 0) {
            uint256 fromPkg2 = nextPackageEscrow >= escrowToUse ? escrowToUse : nextPackageEscrow;
            IMetaGuildXUpgradeFlowIncome(config.incomeEngineContract).releaseEscrowByPkg(userId, currentPkg + 1, fromPkg2);
            escrowToUse -= fromPkg2;
        }

        uint256 pkg1Remainder = IMetaGuildXUpgradeFlowIncome(config.incomeEngineContract).getEscrow(userId);
        if (pkg1Remainder > 0) {
            IMetaGuildXUpgradeFlowIncome(config.incomeEngineContract).releaseEscrow(userId, pkg1Remainder);
            _payoutSettlement(
                enabledPaymentAssets,
                nativePaymentAssets,
                paymentAssetUnitPrice,
                profile.account,
                paymentAsset,
                _platformToSettlement(paymentAssetUnitPrice, paymentAsset, pkg1Remainder)
            );
        }

        manuallyUpgraded[userId] = true;
        tokenAmount = _applyPackageUpgrade(
            usersById,
            userPrimaryAsset,
            activeBoxByUser,
            tokenAllocationsByUser,
            referralCountByPkg,
            nativePaymentAssets,
            paymentAssetUnitPrice,
            config,
            userId,
            newPackageLevel,
            paymentAsset,
            upgradeAmount
        );
        IMetaGuildXUpgradeFlowIncome(config.incomeEngineContract).releaseStrandedEscrow(userId, paymentAsset);
    }

    function processUpgradeFromEngine(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => address) storage userPrimaryAsset,
        mapping(uint256 => uint8) storage activeBoxByUser,
        mapping(uint256 => uint256) storage tokenAllocationsByUser,
        mapping(uint256 => mapping(uint256 => uint256)) storage referralCountByPkg,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        UpgradeConfig memory config,
        uint256 userId,
        uint8 newPackageLevel,
        address paymentAsset,
        uint256 upgradeAmount
    ) external returns (uint256 tokenAmount) {
        return _applyPackageUpgrade(
            usersById,
            userPrimaryAsset,
            activeBoxByUser,
            tokenAllocationsByUser,
            referralCountByPkg,
            nativePaymentAssets,
            paymentAssetUnitPrice,
            config,
            userId,
            newPackageLevel,
            paymentAsset,
            upgradeAmount
        );
    }

    function _applyPackageUpgrade(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => address) storage userPrimaryAsset,
        mapping(uint256 => uint8) storage activeBoxByUser,
        mapping(uint256 => uint256) storage tokenAllocationsByUser,
        mapping(uint256 => mapping(uint256 => uint256)) storage referralCountByPkg,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        UpgradeConfig memory config,
        uint256 userId,
        uint8 newPackageLevel,
        address paymentAsset,
        uint256 upgradeAmount
    ) private returns (uint256 tokenAmount) {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0) revert UserNotFound(userId);
        if (newPackageLevel != profile.packageLevel + 1) revert UpgradeOnlyToNextLevel();

        uint8 previousLevel = profile.packageLevel;
        profile.packageLevel = newPackageLevel;
        profile.totalContribution += upgradeAmount;
        if (paymentAsset != address(0)) {
            userPrimaryAsset[userId] = paymentAsset;
        }

        uint8 appliedBoxId;
        (tokenAmount, appliedBoxId) = _allocateTokens(config.tokenEngineContract, userId, upgradeAmount);
        activeBoxByUser[userId] = appliedBoxId;
        tokenAllocationsByUser[userId] += tokenAmount;
        _transferAllocatedMgx(config.mgxTokenAddress, profile.account, tokenAmount);

        uint256 sponsorId = profile.sponsorId;
        uint8 newPkg = profile.packageLevel;
        if (sponsorId != 0) {
            referralCountByPkg[sponsorId][newPkg] += 1;
        }

        IMetaGuildXUpgradeFlowRouter(config.incomeRouterContract).distributeUpgradeIncome(
            userId,
            profile.sponsorId,
            upgradeAmount,
            paymentAsset
        );
        _distributeCashbackAndCreator(nativePaymentAssets, paymentAssetUnitPrice, config, upgradeAmount, paymentAsset);

        emit PackageUpgraded(userId, previousLevel, newPackageLevel, upgradeAmount);
    }

    function _allocateTokens(
        address tokenEngineContract,
        uint256 userId,
        uint256 packageUsdAmount
    ) private returns (uint256 allocatedTokens, uint8 appliedBoxId) {
        if (tokenEngineContract == address(0)) revert TokenEngineNotSet();
        return IMetaGuildXTokenEngine(tokenEngineContract).allocateTokens(userId, packageUsdAmount);
    }

    function _distributeCashbackAndCreator(
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        UpgradeConfig memory config,
        uint256 packageAmount,
        address paymentAsset
    ) private {
        uint256 cashbackPlatformShare = (packageAmount * config.cashbackJoinShareBps) / 10_000;
        uint256 cashbackSettlementShare = paymentAsset == address(0)
            ? 0
            : (_platformToSettlement(paymentAssetUnitPrice, paymentAsset, packageAmount) * config.cashbackJoinShareBps) / 10_000;

        if (
            config.cashbackPoolContract != address(0) &&
            IMetaGuildXUpgradeFlowCashbackPool(config.cashbackPoolContract).totalSurrenderedUsers() > 0
        ) {
            IMetaGuildXUpgradeFlowCashbackPool(config.cashbackPoolContract).notifyCashbackAccrued(
                packageAmount,
                paymentAsset,
                cashbackSettlementShare
            );
            if (paymentAsset != address(0)) {
                IMetaGuildXUpgradeFlowCashbackPool(config.cashbackPoolContract).distribute(paymentAsset, config.productionMode);
            }
        } else {
            _payoutCreatorAmount(
                nativePaymentAssets,
                paymentAssetUnitPrice,
                config,
                cashbackPlatformShare,
                paymentAsset,
                config.creatorFeeWallet,
                10_000
            );
        }

        _payoutCreatorAmount(
            nativePaymentAssets,
            paymentAssetUnitPrice,
            config,
            packageAmount,
            paymentAsset,
            config.creatorFeeWallet,
            config.creatorShareBps
        );
    }

    function _collectPayment(
        mapping(address => bool) storage enabledPaymentAssets,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        address paymentAsset,
        uint256 platformAmount
    ) private returns (uint256 settlementAmount) {
        _validatePaymentAsset(enabledPaymentAssets, nativePaymentAssets, paymentAssetUnitPrice, paymentAsset);
        settlementAmount = MetaGuildXPaymentLib.collectPayment(
            paymentAsset,
            nativePaymentAssets[paymentAsset],
            paymentAssetUnitPrice[paymentAsset],
            msg.value,
            msg.sender,
            platformAmount
        );

        emit PaymentCollected(msg.sender, paymentAsset, platformAmount, settlementAmount);
    }

    function _payoutSettlement(
        mapping(address => bool) storage enabledPaymentAssets,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        address recipient,
        address paymentAsset,
        uint256 settlementAmount
    ) private {
        _validatePaymentAsset(enabledPaymentAssets, nativePaymentAssets, paymentAssetUnitPrice, paymentAsset);
        MetaGuildXPaymentLib.payoutSettlement(
            recipient,
            paymentAsset,
            nativePaymentAssets[paymentAsset],
            settlementAmount
        );

        emit PaymentWithdrawn(recipient, paymentAsset, 0, settlementAmount);
    }

    function _platformToSettlement(
        mapping(address => uint256) storage paymentAssetUnitPrice,
        address paymentAsset,
        uint256 platformAmount
    ) private view returns (uint256) {
        return MetaGuildXPaymentLib.platformToSettlement(paymentAsset, paymentAssetUnitPrice[paymentAsset], platformAmount);
    }

    function _payoutCreatorAmount(
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        UpgradeConfig memory config,
        uint256 platformAmount,
        address paymentAsset,
        address recipient,
        uint256 bps
    ) private {
        if (paymentAsset == address(0) || platformAmount == 0) {
            return;
        }

        address payoutRecipient = recipient == address(0) ? config.creatorFeeWallet : recipient;
        MetaGuildXPaymentLib.payoutCreatorAmount(
            paymentAsset,
            nativePaymentAssets[paymentAsset],
            paymentAssetUnitPrice[paymentAsset],
            platformAmount,
            payoutRecipient,
            bps
        );
        uint256 settlementAmount = (_platformToSettlement(paymentAssetUnitPrice, paymentAsset, platformAmount) * bps) / 10_000;
        if (settlementAmount > 0) {
            emit PaymentWithdrawn(payoutRecipient, paymentAsset, 0, settlementAmount);
        }
    }

    function _validatePaymentAsset(
        mapping(address => bool) storage enabledPaymentAssets,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        address paymentAsset
    ) private view {
        if (!enabledPaymentAssets[paymentAsset]) revert PaymentAssetDisabled();
        if (!nativePaymentAssets[paymentAsset]) {
            _validateContract(paymentAsset);
        }
        if (paymentAssetUnitPrice[paymentAsset] == 0) revert PaymentAssetNotConfigured();
    }

    function _validateContract(address target) private view {
        if (target == address(0) || target.code.length == 0) revert InvalidContract();
    }

    function _transferAllocatedMgx(address mgxTokenAddress, address account, uint256 tokenAmount) private {
        if (tokenAmount > 0 && mgxTokenAddress != address(0)) {
            MetaGuildXPaymentLib.safeTransferExact(mgxTokenAddress, account, tokenAmount, "MGX_TRANSFER_FAILED");
        }
    }
}
