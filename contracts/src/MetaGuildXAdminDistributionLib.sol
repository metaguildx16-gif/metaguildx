// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./libraries/MGXTypes.sol";
import "./libs/MetaGuildXPaymentLib.sol";

interface IMetaGuildXRouterDist {
    function distributeJoinIncome(uint256,uint256,uint256,uint256,address,uint256) external;
    function adminDirectPayout(uint256,uint256,uint256,address,uint8) external;
    function adminRemainderDistribution(uint256,uint256,uint256,uint8,uint256,address,uint256) external;
}

interface IMetaGuildXBinaryTreeDist {
    function getParent(uint256 userId) external view returns (uint256);
}

interface IMetaGuildXCashbackPoolDist {
    function totalSurrenderedUsers() external view returns (uint256);
    function notifyCashbackAccrued(uint256,address,uint256) external;
    function distribute(address,bool) external returns (uint256);
}

library MetaGuildXAdminDistributionLib {

    event DistributionRetried(uint256 indexed userId, bool success);
    event DistributionFailedReason(uint256 indexed userId, bytes reason);
    event PaymentWithdrawn(address indexed recipient, address indexed asset, uint256 platformAmount, uint256 settlementAmount);

    error UserNotFound(uint256 userId);
    error NotFailedDistribution(uint256 userId);

    uint256 private constant CASHBACK_JOIN_SHARE_BPS = 400;
    uint256 private constant CREATOR_SHARE_BPS = 1000;

    struct DistConfig {
        address incomeRouterContract;
        address binaryTreeContract;
        address cashbackPoolContract;
        address creatorFeeWallet;
        address defaultPaymentAsset;
        bool productionMode;
    }

    function adminForceDistributeJoinIncome(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => uint256) storage rebirthOriginalUserId,
        mapping(uint256 => bool) storage failedDistribution,
        uint256[] storage packagePricesArray,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        mapping(address => bool) storage nativePaymentAssets,
        DistConfig memory cfg,
        uint256 userId
    ) external {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0) revert UserNotFound(userId);

        // Preserve exact getPackagePriceByLevel semantics: returns 0 for invalid level
        uint256 packageAmount = (profile.packageLevel == 0 || profile.packageLevel > packagePricesArray.length)
            ? 0 : packagePricesArray[profile.packageLevel - 1];

        uint256 placedUnderId = cfg.binaryTreeContract != address(0)
            ? IMetaGuildXBinaryTreeDist(cfg.binaryTreeContract).getParent(userId) : 0;
        uint256 originalUserId = profile.rebirthCount > 0 ? rebirthOriginalUserId[userId] : 0;

        try IMetaGuildXRouterDist(cfg.incomeRouterContract).distributeJoinIncome(
            userId, profile.sponsorId, placedUnderId, packageAmount, cfg.defaultPaymentAsset, originalUserId
        ) {
            failedDistribution[userId] = false;
            _distributeCashbackAndCreator(
                packageAmount, cfg.defaultPaymentAsset,
                cfg.cashbackPoolContract, cfg.creatorFeeWallet,
                paymentAssetUnitPrice, nativePaymentAssets, cfg.productionMode
            );
            emit DistributionRetried(userId, true);
        } catch (bytes memory reason) {
            emit DistributionRetried(userId, false);
            emit DistributionFailedReason(userId, reason);
        }
    }

    function adminForceResolveFailedDistribution(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => bool) storage failedDistribution,
        mapping(uint256 => address) storage userPrimaryAsset,
        uint256[] storage packagePricesArray,
        address incomeRouterContract,
        address defaultPaymentAsset,
        uint256 userId
    ) external {
        if (!failedDistribution[userId]) revert NotFailedDistribution(userId);

        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0) revert UserNotFound(userId);

        uint8 origLevel = profile.originalPackageLevel;
        uint256 packageAmount = (origLevel == 0 || origLevel > packagePricesArray.length)
            ? 0 : packagePricesArray[origLevel - 1];

        address paymentAsset = userPrimaryAsset[userId];
        if (paymentAsset == address(0)) paymentAsset = defaultPaymentAsset;

        uint256 directIncome = (packageAmount * 4600) / 10000;

        IMetaGuildXRouterDist(incomeRouterContract).adminDirectPayout(
            userId, profile.sponsorId, directIncome, paymentAsset, origLevel
        );

        failedDistribution[userId] = false;
        emit DistributionRetried(userId, true);
    }

    function adminRemainderDistribution(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        uint256[] storage packagePricesArray,
        mapping(uint256 => address) storage userPrimaryAsset,
        address incomeRouterContract,
        address binaryTreeContract,
        address defaultPaymentAsset,
        uint256 userId
    ) external {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0) revert UserNotFound(userId);

        uint8 origLevel = profile.originalPackageLevel;
        uint256 packageAmount = (origLevel == 0 || origLevel > packagePricesArray.length)
            ? 0 : packagePricesArray[origLevel - 1];

        address paymentAsset = userPrimaryAsset[userId];
        if (paymentAsset == address(0)) paymentAsset = defaultPaymentAsset;

        uint256 placedUnderId = binaryTreeContract != address(0)
            ? IMetaGuildXBinaryTreeDist(binaryTreeContract).getParent(userId) : 0;

        IMetaGuildXRouterDist(incomeRouterContract).adminRemainderDistribution(
            userId, profile.sponsorId, placedUnderId, origLevel, packageAmount, paymentAsset, 0
        );
    }

    // Exact copy of Core._distributeCashbackAndCreator for admin path
    // Core keeps its own copy for registration paths — not DRY but avoids circular dependency
    function _distributeCashbackAndCreator(
        uint256 packageAmount,
        address paymentAsset,
        address cashbackPoolContract,
        address creatorFeeWallet,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        mapping(address => bool) storage nativePaymentAssets,
        bool productionMode
    ) private {
        uint256 cashbackPlatformShare = (packageAmount * CASHBACK_JOIN_SHARE_BPS) / 10_000;
        uint256 cashbackSettlementShare = paymentAsset == address(0)
            ? 0
            : (MetaGuildXPaymentLib.platformToSettlement(
                paymentAsset, paymentAssetUnitPrice[paymentAsset], packageAmount
              ) * CASHBACK_JOIN_SHARE_BPS) / 10_000;

        if (
            cashbackPoolContract != address(0) &&
            IMetaGuildXCashbackPoolDist(cashbackPoolContract).totalSurrenderedUsers() > 0
        ) {
            IMetaGuildXCashbackPoolDist(cashbackPoolContract).notifyCashbackAccrued(
                packageAmount, paymentAsset, cashbackSettlementShare
            );
            if (paymentAsset != address(0)) {
                IMetaGuildXCashbackPoolDist(cashbackPoolContract).distribute(paymentAsset, productionMode);
            }
        } else {
            _payoutCreatorAmount(
                cashbackPlatformShare, paymentAsset, creatorFeeWallet, 10_000,
                paymentAssetUnitPrice, nativePaymentAssets
            );
        }
        _payoutCreatorAmount(
            packageAmount, paymentAsset, creatorFeeWallet, CREATOR_SHARE_BPS,
            paymentAssetUnitPrice, nativePaymentAssets
        );
    }

    function _payoutCreatorAmount(
        uint256 platformAmount,
        address paymentAsset,
        address recipient,
        uint256 bps,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        mapping(address => bool) storage nativePaymentAssets
    ) private {
        if (paymentAsset == address(0) || platformAmount == 0) return;
        address payoutRecipient = recipient == address(0) ? address(0) : recipient;
        if (payoutRecipient == address(0)) return;
        MetaGuildXPaymentLib.payoutCreatorAmount(
            paymentAsset,
            nativePaymentAssets[paymentAsset],
            paymentAssetUnitPrice[paymentAsset],
            platformAmount,
            payoutRecipient,
            bps
        );
        uint256 settlementAmount = (MetaGuildXPaymentLib.platformToSettlement(
            paymentAsset, paymentAssetUnitPrice[paymentAsset], platformAmount
        ) * bps) / 10_000;
        if (settlementAmount > 0) {
            emit PaymentWithdrawn(payoutRecipient, paymentAsset, 0, settlementAmount);
        }
    }
}
