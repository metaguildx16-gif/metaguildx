// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IMetaGuildXTokenEngine.sol";
import "./libraries/MGXTypes.sol";

interface IMetaGuildXRebirthBinaryTree {
    function placeUserForced(uint256 userId, uint256 parentId, bool forceLeft) external;
    function findNextSlotUnderSponsor(uint256 sponsorId) external view returns (uint256 parentId, bool isLeft);
    function getParent(uint256 userId) external view returns (uint256);
    function getChildren(uint256 userId) external view returns (uint256 left, uint256 right);
    function refreshLevelEligibility(uint256 userId, uint256 referralCount, uint256 sponsorId) external;
}

interface IMetaGuildXRebirthRouter {
    function distributeJoinIncome(
        uint256 fromUserId,
        uint256 sponsorId,
        uint256 placedUnderId,
        uint256 businessAmount,
        address paymentAsset,
        uint256 originalUserId
    ) external;
}

interface IMetaGuildXRebirthUpgradeEngine {
    function getRebirthIds(uint256 userId) external view returns (uint256[] memory);
}

interface IMetaGuildXRebirthCashbackPool {
    function notifyCashbackAccrued(uint256 platformAmount, address paymentAsset, uint256 settlementAmount) external;
    function distribute(address paymentAsset, bool productionMode) external returns (uint256 totalAmount);
    function totalSurrenderedUsers() external view returns (uint256);
}

interface IMetaGuildXRebirthCoreView {
    function getPackagePriceByLevel(uint256 level) external view returns (uint256);
}

error UserNotFound(uint256 userId);
error NotFailedDistribution(uint256 userId);
error InsufficientCoreBalance();
error NativePayoutFailed();
error TokenEngineNotSet();

library MetaGuildXRebirthLib {
    event UserRegistered(
        uint256 indexed userId,
        uint256 indexed sponsorId,
        address indexed account,
        uint8 packageLevel,
        uint256 amount,
        uint256 placedUnderId,
        bool placedLeft
    );
    event RebirthUserCreated(uint256 indexed originalUserId, uint256 indexed newUserId, address wallet);
    event PaymentWithdrawn(address indexed recipient, address indexed asset, uint256 platformAmount, uint256 settlementAmount);
    event DistributionFailed(uint256 indexed userId, uint256 timestamp);
    event DistributionFailedReason(uint256 indexed userId, bytes reason);
    event DistributionRetried(uint256 indexed userId, bool success);

    struct RebirthConfig {
        uint256 nextUserId;
        address binaryTreeContract;
        address upgradeEngineContract;
        address incomeRouterContract;
        address cashbackPoolContract;
        address creatorFeeWallet;
        address defaultPaymentAsset;
        address mgxTokenAddress;
        address tokenEngineContract;
        bool productionMode;
        uint256 cashbackJoinShareBps;
        uint256 creatorShareBps;
        uint256 maxSubtreeDepth;
    }

    function createRebirthUser(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => uint256[]) storage directReferralsByUser,
        mapping(uint256 => mapping(uint256 => uint256)) storage referralCountByPkg,
        mapping(uint256 => address) storage userPrimaryAsset,
        mapping(uint256 => uint256) storage tokenAllocationsByUser,
        mapping(uint256 => uint8) storage activeBoxByUser,
        mapping(uint256 => bool) storage activeUsers,
        mapping(uint256 => uint256) storage rebirthOriginalUserId,
        mapping(uint256 => bool) storage failedDistribution,
        uint256[] storage failedUserIds,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        RebirthConfig memory config,
        uint256 originalUserId
    ) external returns (uint256 newId, uint256 nextUserIdValue, uint256 tokenAmount) {
        MGXTypes.UserProfile storage original = usersById[originalUserId];
        if (original.id == 0) revert UserNotFound(originalUserId);

        address wallet = original.account;
        uint256 baseSponsorId = original.sponsorId;
        uint256 placementSponsorId = _resolvePlacementSponsor(config, baseSponsorId, originalUserId);
        bool weakLeft = _resolveWeakLeg(config, baseSponsorId, originalUserId, placementSponsorId);
        address paymentAsset = userPrimaryAsset[originalUserId];
        if (paymentAsset == address(0)) paymentAsset = config.defaultPaymentAsset;

        uint256 weakChild;
        if (config.binaryTreeContract != address(0)) {
            (uint256 leftChildId, uint256 rightChildId) =
                IMetaGuildXRebirthBinaryTree(config.binaryTreeContract).getChildren(placementSponsorId);
            weakChild = weakLeft ? leftChildId : rightChildId;
        }

        newId = config.nextUserId;
        nextUserIdValue = newId + 1;
        uint256 packageAmount = IMetaGuildXRebirthCoreView(address(this)).getPackagePriceByLevel(1);
        (uint256 placedUnderId, bool actualPlacedLeft) = weakChild == 0
            ? _placeInForcedSlot(config.binaryTreeContract, newId, placementSponsorId, weakLeft)
            : _placeInSpecifiedSlot(config.binaryTreeContract, newId, weakChild);

        usersById[newId] = MGXTypes.UserProfile({
            id: newId,
            account: wallet,
            sponsorId: placementSponsorId,
            packageLevel: 1,
            originalPackageLevel: 1,
            totalContribution: packageAmount,
            totalEarnings: 0,
            directReferrals: 0,
            totalTeamBusiness: 0,
            rebirthCount: 1,
            xCount: 0,
            joinedAt: block.timestamp,
            surrendered: false
        });
        activeUsers[newId] = true;
        userPrimaryAsset[newId] = paymentAsset;
        rebirthOriginalUserId[newId] = originalUserId;

        uint8 appliedBoxId;
        (tokenAmount, appliedBoxId) = _allocateTokens(config.tokenEngineContract, newId, packageAmount);
        activeBoxByUser[newId] = appliedBoxId;
        tokenAllocationsByUser[newId] += tokenAmount;
        _transferAllocatedMgx(config.mgxTokenAddress, wallet, tokenAmount);

        usersById[placementSponsorId].directReferrals += 1;
        usersById[placementSponsorId].totalTeamBusiness += packageAmount;
        directReferralsByUser[placementSponsorId].push(newId);
        referralCountByPkg[placementSponsorId][1] += 1;

        if (config.binaryTreeContract != address(0)) {
            IMetaGuildXRebirthBinaryTree(config.binaryTreeContract).refreshLevelEligibility(
                placementSponsorId,
                usersById[placementSponsorId].directReferrals,
                usersById[placementSponsorId].sponsorId
            );
        }

        try IMetaGuildXRebirthRouter(config.incomeRouterContract).distributeJoinIncome(
            newId,
            placementSponsorId,
            placedUnderId,
            packageAmount,
            paymentAsset,
            originalUserId
        ) {
            _distributeCashbackAndCreator(nativePaymentAssets, paymentAssetUnitPrice, config, packageAmount, paymentAsset);
        } catch (bytes memory reason) {
            failedDistribution[newId] = true;
            failedUserIds.push(newId);
            emit DistributionFailed(newId, block.timestamp);
            emit DistributionFailedReason(newId, reason);
        }

        emit UserRegistered(newId, placementSponsorId, wallet, 1, packageAmount, placedUnderId, actualPlacedLeft);
        emit RebirthUserCreated(originalUserId, newId, wallet);
    }

    function adminRetryDistribution(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => address) storage userPrimaryAsset,
        mapping(uint256 => uint256) storage rebirthOriginalUserId,
        mapping(uint256 => bool) storage failedDistribution,
        mapping(uint256 => uint8) storage failedDistributionPackageLevel,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        RebirthConfig memory config,
        uint256 userId
    ) external {
        if (!failedDistribution[userId]) revert NotFailedDistribution(userId);
        address paymentAsset = _resolveRetryPaymentAsset(userPrimaryAsset, rebirthOriginalUserId, config, userId);
        _retryDistributionForUser(
            usersById,
            rebirthOriginalUserId,
            failedDistribution,
            failedDistributionPackageLevel,
            nativePaymentAssets,
            paymentAssetUnitPrice,
            config,
            userId,
            paymentAsset
        );
    }

    function adminRetryRebirthDistribution(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => address) storage userPrimaryAsset,
        mapping(uint256 => uint256) storage rebirthOriginalUserId,
        mapping(uint256 => bool) storage failedDistribution,
        mapping(uint256 => uint8) storage failedDistributionPackageLevel,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        RebirthConfig memory config,
        uint256 rebirthUserId,
        uint256 originalUserId
    ) external {
        if (!failedDistribution[rebirthUserId]) revert NotFailedDistribution(rebirthUserId);
        if (usersById[rebirthUserId].rebirthCount == 0) revert UserNotFound(rebirthUserId);
        if (usersById[originalUserId].id == 0) revert UserNotFound(originalUserId);

        rebirthOriginalUserId[rebirthUserId] = originalUserId;
        address paymentAsset = _resolveRetryPaymentAsset(userPrimaryAsset, rebirthOriginalUserId, config, rebirthUserId);
        _retryDistributionForUser(
            usersById,
            rebirthOriginalUserId,
            failedDistribution,
            failedDistributionPackageLevel,
            nativePaymentAssets,
            paymentAssetUnitPrice,
            config,
            rebirthUserId,
            paymentAsset
        );
    }

    function _retryDistributionForUser(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => uint256) storage rebirthOriginalUserId,
        mapping(uint256 => bool) storage failedDistribution,
        mapping(uint256 => uint8) storage failedDistributionPackageLevel,
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        RebirthConfig memory config,
        uint256 userId,
        address paymentAsset
    ) private {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0) revert UserNotFound(userId);

        uint8 retryPackageLevel = failedDistributionPackageLevel[userId];
        if (retryPackageLevel == 0) {
            retryPackageLevel = profile.originalPackageLevel;
        }
        uint256 packageAmount = IMetaGuildXRebirthCoreView(address(this)).getPackagePriceByLevel(retryPackageLevel);
        uint256 placedUnderId = IMetaGuildXRebirthBinaryTree(config.binaryTreeContract).getParent(userId);
        uint256 originalUserId = profile.rebirthCount > 0 ? rebirthOriginalUserId[userId] : 0;
        uint256 settlementAmt = _platformToSettlement(paymentAssetUnitPrice, paymentAsset, packageAmount);
        if (paymentAsset != address(0)) {
            uint256 coreBal = IERC20(paymentAsset).balanceOf(address(this));
            if (coreBal < settlementAmt) revert InsufficientCoreBalance();
        }

        uint8 currentPackageLevelSnapshot = profile.packageLevel;
        profile.packageLevel = retryPackageLevel;
        try IMetaGuildXRebirthRouter(config.incomeRouterContract).distributeJoinIncome(
            userId,
            profile.sponsorId,
            placedUnderId,
            packageAmount,
            paymentAsset,
            originalUserId
        ) {
            profile.packageLevel = currentPackageLevelSnapshot;
            failedDistribution[userId] = false;
            _distributeCashbackAndCreator(nativePaymentAssets, paymentAssetUnitPrice, config, packageAmount, paymentAsset);
            emit DistributionRetried(userId, true);
        } catch (bytes memory reason) {
            profile.packageLevel = currentPackageLevelSnapshot;
            emit DistributionRetried(userId, false);
            emit DistributionFailedReason(userId, reason);
        }
    }

    function _resolveRetryPaymentAsset(
        mapping(uint256 => address) storage userPrimaryAsset,
        mapping(uint256 => uint256) storage rebirthOriginalUserId,
        RebirthConfig memory config,
        uint256 userId
    ) private view returns (address paymentAsset) {
        if (!config.productionMode) return address(0);

        paymentAsset = userPrimaryAsset[userId];
        uint256 originalUserId = rebirthOriginalUserId[userId];
        if (paymentAsset == address(0) && originalUserId != 0) paymentAsset = userPrimaryAsset[originalUserId];
        if (paymentAsset == address(0)) paymentAsset = config.defaultPaymentAsset;
    }

    function _resolvePlacementSponsor(
        RebirthConfig memory config,
        uint256 baseSponsorId,
        uint256 originalUserId
    ) private view returns (uint256) {
        if (baseSponsorId == 0) return originalUserId;
        uint256[] memory sponsorRebirths =
            IMetaGuildXRebirthUpgradeEngine(config.upgradeEngineContract).getRebirthIds(baseSponsorId);
        return sponsorRebirths.length > 0 ? sponsorRebirths[sponsorRebirths.length - 1] : baseSponsorId;
    }

    function _resolveWeakLeg(
        RebirthConfig memory config,
        uint256 baseSponsorId,
        uint256 originalUserId,
        uint256 placementSponsorId
    ) private view returns (bool) {
        if (baseSponsorId == 0) return _findWeakLeg(config, placementSponsorId);

        uint256[] memory sponsorRebirths =
            IMetaGuildXRebirthUpgradeEngine(config.upgradeEngineContract).getRebirthIds(baseSponsorId);
        if (sponsorRebirths.length > 0) return _findWeakLeg(config, placementSponsorId);

        (uint256 leftChildId, uint256 rightChildId) =
            IMetaGuildXRebirthBinaryTree(config.binaryTreeContract).getChildren(baseSponsorId);
        if (leftChildId == originalUserId) return false;
        if (rightChildId == originalUserId) return true;
        return _findWeakLeg(config, placementSponsorId);
    }

    function _findWeakLeg(RebirthConfig memory config, uint256 uplineId) private view returns (bool isLeft) {
        (uint256 leftChildId, uint256 rightChildId) =
            IMetaGuildXRebirthBinaryTree(config.binaryTreeContract).getChildren(uplineId);
        uint256 leftCount = _getSubtreeCount(config.binaryTreeContract, leftChildId, 0, config.maxSubtreeDepth);
        uint256 rightCount = _getSubtreeCount(config.binaryTreeContract, rightChildId, 0, config.maxSubtreeDepth);
        return leftCount <= rightCount;
    }

    function _getSubtreeCount(
        address binaryTreeContract,
        uint256 nodeId,
        uint256 depth,
        uint256 maxSubtreeDepth
    ) private view returns (uint256) {
        if (nodeId == 0 || depth >= maxSubtreeDepth) return 0;
        (uint256 leftChildId, uint256 rightChildId) =
            IMetaGuildXRebirthBinaryTree(binaryTreeContract).getChildren(nodeId);
        return 1
            + _getSubtreeCount(binaryTreeContract, leftChildId, depth + 1, maxSubtreeDepth)
            + _getSubtreeCount(binaryTreeContract, rightChildId, depth + 1, maxSubtreeDepth);
    }

    function _placeInSpecifiedSlot(
        address binaryTreeContract,
        uint256 userId,
        uint256 sponsorId
    ) private returns (uint256 placedUnderId, bool actualPlacedLeft) {
        (uint256 parentId, bool isLeft) =
            IMetaGuildXRebirthBinaryTree(binaryTreeContract).findNextSlotUnderSponsor(sponsorId);
        IMetaGuildXRebirthBinaryTree(binaryTreeContract).placeUserForced(userId, parentId, isLeft);
        return (parentId, isLeft);
    }

    function _placeInForcedSlot(
        address binaryTreeContract,
        uint256 userId,
        uint256 parentId,
        bool forceLeft
    ) private returns (uint256 placedUnderId, bool placedLeft) {
        IMetaGuildXRebirthBinaryTree(binaryTreeContract).placeUserForced(userId, parentId, forceLeft);
        return (parentId, forceLeft);
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
        RebirthConfig memory config,
        uint256 packageAmount,
        address paymentAsset
    ) private {
        uint256 cashbackPlatformShare = (packageAmount * config.cashbackJoinShareBps) / 10_000;
        uint256 cashbackSettlementShare = paymentAsset == address(0)
            ? 0
            : (_platformToSettlement(paymentAssetUnitPrice, paymentAsset, packageAmount) * config.cashbackJoinShareBps) / 10_000;

        if (
            config.cashbackPoolContract != address(0) &&
            IMetaGuildXRebirthCashbackPool(config.cashbackPoolContract).totalSurrenderedUsers() > 0
        ) {
            IMetaGuildXRebirthCashbackPool(config.cashbackPoolContract).notifyCashbackAccrued(
                packageAmount,
                paymentAsset,
                cashbackSettlementShare
            );
            if (paymentAsset != address(0)) {
                IMetaGuildXRebirthCashbackPool(config.cashbackPoolContract).distribute(paymentAsset, config.productionMode);
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

    function _platformToSettlement(
        mapping(address => uint256) storage paymentAssetUnitPrice,
        address paymentAsset,
        uint256 platformAmount
    ) private view returns (uint256) {
        if (paymentAsset == address(0)) return 0;
        return platformAmount * paymentAssetUnitPrice[paymentAsset];
    }

    function _payoutCreatorAmount(
        mapping(address => bool) storage nativePaymentAssets,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        RebirthConfig memory config,
        uint256 platformAmount,
        address paymentAsset,
        address recipient,
        uint256 bps
    ) private {
        if (paymentAsset == address(0) || platformAmount == 0) return;

        address payoutRecipient = recipient == address(0) ? config.creatorFeeWallet : recipient;
        uint256 settlementAmount = (_platformToSettlement(paymentAssetUnitPrice, paymentAsset, platformAmount) * bps) / 10_000;
        if (settlementAmount == 0) return;

        if (nativePaymentAssets[paymentAsset]) {
            (bool ok,) = payable(payoutRecipient).call{value: settlementAmount}("");
            if (!ok) revert NativePayoutFailed();
        } else {
            _safeTransferExact(paymentAsset, payoutRecipient, settlementAmount);
        }
        emit PaymentWithdrawn(payoutRecipient, paymentAsset, 0, settlementAmount);
    }

    function _transferAllocatedMgx(address mgxTokenAddress, address account, uint256 tokenAmount) private {
        if (tokenAmount > 0 && mgxTokenAddress != address(0)) {
            _safeTransferExact(mgxTokenAddress, account, tokenAmount);
        }
    }

    function _safeTransferExact(address token, address to, uint256 amount) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }
}
