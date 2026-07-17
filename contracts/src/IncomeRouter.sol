// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
interface IIncomeSystemCore {
    function getUserSponsorId(uint256 userId) external view returns (uint256);
    function getBinaryParent(uint256 userId) external view returns (uint256);
    function isInSponsorGenealogy(uint256 candidateId, uint256 rootId) external view returns (bool);
    function getParent(uint256 userId) external view returns (uint256);
    function getLevelParent(uint256 userId) external view returns (uint256);
    function isLevelEligibleUser(uint256 userId) external view returns (bool);
    function getPackagePriceByLevel(uint256 packageLevel) external view returns (uint256);
    function cashbackPoolContract() external view returns (address);
    function paymentAssetUnitPrice(address asset) external view returns (uint256);
    function usersById(
        uint256 userId
    )
        external
        view
        returns (
            uint256 id,
            address account,
            uint256 sponsorId,
            uint8 packageLevel,
            uint8 originalPackageLevel,
            uint256 totalContribution,
            uint256 totalEarnings,
            uint256 directReferrals,
            uint256 totalTeamBusiness,
            uint256 rebirthCount,
            uint256 xCount,
            uint256 joinedAt,
            bool surrendered
        );
    function referralCountByPkg(uint256 sponsorId, uint256 packageLevel) external view returns (uint256);
    function incrementUserTeamBusiness(uint256 userId, uint256 amount) external;
    function routeCreatorFallbackIncome(
        uint256 fromUserId,
        uint256 amount,
        string calldata incomeType,
        address paymentAsset,
        address recipient
    ) external;
    function routeCashbackCreatorRemainder(uint256 packageAmount, address paymentAsset) external;
}

interface IMetaGuildXCashbackPool {
    function totalSurrenderedUsers() external view returns (uint256);
}

interface IMetaGuildXIncomeEngine {
    function routeIncome(uint256 userId, uint256 amount, address asset, string calldata incomeType, uint8 cyclePkgLevel)
        external;
    function getTotalEscrow(uint256 userId) external view returns (uint256);
    function getTotalAllIncome(uint256 userId) external view returns (uint256);
}

contract IncomeRouter is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    uint256 public constant DIRECT_INCOME_BPS = 4_600;
    uint256 public constant LEVEL_INCOME_BPS = 400;
    uint256 public constant CASHBACK_BPS = 400;
    uint256 public constant CREATOR_FEE_BPS = 1_000;
    uint8 public constant MAX_LEVELS = 10;
    uint8 public constant MAX_SEARCH_DEPTH = 50;
    uint8 public constant MAX_SPILLOVER_SEARCH = 20;
    uint8 private constant INCOME_TYPE_DIRECT = 0;
    uint8 private constant INCOME_TYPE_LEVEL = 1;
    uint8 private constant INCOME_TYPE_SPILLOVER = 2;
    uint8 private constant INCOME_TYPE_CROSSLINE = 3;

    address public coreContract;
    address public stakingContract;
    uint256 public platformReserve;

    event DirectIncomeRecorded(
        uint256 indexed fromUserId,
        uint256 indexed toUserId,
        uint256 amount,
        uint8 cyclePkgLevel
    );
    event LevelIncomeRecorded(
        uint256 indexed fromUserId,
        uint256 indexed toUserId,
        uint8 level,
        uint256 amount,
        uint8 cyclePkgLevel
    );
    event LevelIncomeSkipped(
        uint256 indexed skippedUserId,
        uint256 indexed fromUserId,
        uint8 indexed level,
        address asset,
        uint256 amount,
        uint256 timestamp
    );
    event SpilloverIncome(uint256 indexed receiver, uint256 amount, uint8 fromLevel);
    event SpilloverToPlatform(uint256 amount, uint8 fromLevel);
    event CrossLineIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount);
    event CoreContractSet(address indexed coreContractAddress);
    event StakingContractSet(address indexed stakingContractAddress);
    event IncomeEngineContractSet(address indexed incomeEngineContractAddress);
    event CreatorWalletSet(address indexed creatorWalletAddress);
    event UnallocatedFundsRecovered(address indexed asset, uint256 amount, address indexed recipient);
    event FundsRecovered(uint256 amount);
    event EmergencySweep(address indexed token, address indexed recipient, uint256 amount);
    event ResidualSweptToCreator(uint256 amount);

    modifier onlyCore() {
        require(msg.sender == coreContract, "Only core contract");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        creatorWallet = initialOwner;
        require(
            DIRECT_INCOME_BPS + (LEVEL_INCOME_BPS * MAX_LEVELS) + CASHBACK_BPS + CREATOR_FEE_BPS == 10_000,
            "BPS must sum to 10000"
        );
    }

    function setCoreContract(address coreContractAddress) external onlyOwner {
        _validateContract(coreContractAddress);
        coreContract = coreContractAddress;
        emit CoreContractSet(coreContractAddress);
    }

    function setStakingContract(address stakingContractAddress) external onlyOwner {
        _validateContract(stakingContractAddress);
        stakingContract = stakingContractAddress;
        emit StakingContractSet(stakingContractAddress);
    }

    function setIncomeEngineContract(address incomeEngineContractAddress) external onlyOwner {
        _validateContract(incomeEngineContractAddress);
        incomeEngineContract = incomeEngineContractAddress;
        emit IncomeEngineContractSet(incomeEngineContractAddress);
    }

    function setCreatorWallet(address creatorWalletAddress) external onlyOwner {
        require(creatorWalletAddress != address(0), "zero address");
        creatorWallet = creatorWalletAddress;
        emit CreatorWalletSet(creatorWalletAddress);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function recoverUnallocatedFunds(address asset) external onlyOwner {
        require(creatorWallet != address(0), "creator wallet not set");
        require(asset != address(0), "invalid asset");

        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        require(contractBalance > 0, "nothing to recover");

        _safeTransferExact(asset, creatorWallet, contractBalance, "TRANSFER_FAILED");
        emit UnallocatedFundsRecovered(asset, contractBalance, creatorWallet);
    }

    function emergencySweep(address token, address recipient) external onlyOwner {
        require(token != address(0), "invalid token");
        require(recipient != address(0), "invalid recipient");

        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "Nothing to sweep");

        _safeTransferExact(token, recipient, balance, "TRANSFER_FAILED");
        emit EmergencySweep(token, recipient, balance);
    }

    function distributeJoinIncome(
        uint256 fromUserId,
        uint256 sponsorId,
        uint256 placedUnderId,
        uint256 businessAmount,
        address paymentAsset,
        uint256 originalUserId
    ) external onlyCore whenNotPaused {
        IIncomeSystemCore core = IIncomeSystemCore(coreContract);
        uint8 juniorPkgLevel = _getUserPackageLevel(core, fromUserId);
        uint256 balanceBefore = paymentAsset == address(0) ? 0 : IERC20(paymentAsset).balanceOf(address(this));
        uint256 directIncome = _calculateBps(businessAmount, DIRECT_INCOME_BPS);
        if (sponsorId == 0) {
            _routeCreatorFallbackIncome(core, fromUserId, directIncome, "direct", paymentAsset);
            _distributeLevelIncome(
                fromUserId, sponsorId, placedUnderId, juniorPkgLevel, businessAmount, paymentAsset, originalUserId
            );
        } else {
            uint8 sponsorPkgLevel = _getUserPackageLevel(core, sponsorId);
            if (juniorPkgLevel > sponsorPkgLevel) {
                _payoutUserIncome(
                    core, fromUserId, sponsorId, directIncome, "escrow_direct", paymentAsset, juniorPkgLevel
                );
            } else {
                _payoutUserIncome(core, fromUserId, sponsorId, directIncome, "direct", paymentAsset, juniorPkgLevel);
            }
            emit DirectIncomeRecorded(fromUserId, sponsorId, directIncome, juniorPkgLevel);
            _distributeLevelIncome(
                fromUserId, sponsorId, placedUnderId, juniorPkgLevel, businessAmount, paymentAsset, originalUserId
            );
        }

        _sweepResidualToCreator(paymentAsset, balanceBefore);
    }

    function distributeUpgradeIncome(
        uint256 fromUserId,
        uint256 sponsorId,
        uint256 businessAmount,
        address paymentAsset
    ) external onlyCore whenNotPaused {
        IIncomeSystemCore core = IIncomeSystemCore(coreContract);
        uint8 juniorPkgLevel = _getUserPackageLevel(core, fromUserId);
        uint256 balanceBefore = paymentAsset == address(0) ? 0 : IERC20(paymentAsset).balanceOf(address(this));
        uint256 directIncome = _calculateBps(businessAmount, DIRECT_INCOME_BPS);
        if (sponsorId == 0) {
            _routeCreatorFallbackIncome(core, fromUserId, directIncome, "direct", paymentAsset);
        } else {
            uint8 sponsorPkgLevelUp = _getUserPackageLevel(core, sponsorId);
            if (juniorPkgLevel > sponsorPkgLevelUp) {
                _payoutUserIncome(
                    core, fromUserId, sponsorId, directIncome, "escrow_direct", paymentAsset, juniorPkgLevel
                );
            } else {
                _payoutUserIncome(core, fromUserId, sponsorId, directIncome, "direct", paymentAsset, juniorPkgLevel);
            }
            emit DirectIncomeRecorded(fromUserId, sponsorId, directIncome, juniorPkgLevel);
        }
        _distributeLevelIncome(
            fromUserId,
            sponsorId,
            core.getLevelParent(fromUserId),
            juniorPkgLevel,
            businessAmount,
            paymentAsset,
            0
        );
        _sweepResidualToCreator(paymentAsset, balanceBefore);
    }

    function distributeCrosslineIncome(
        uint256 fromUserId,
        uint256 toUserId,
        uint256 amount,
        address paymentAsset
    ) external onlyCore {
        if (amount == 0 || toUserId == 0) {
            return;
        }

        IIncomeSystemCore core = IIncomeSystemCore(coreContract);
        uint8 juniorPkgLevel = _getUserPackageLevel(core, fromUserId);
        uint256 balanceBefore = paymentAsset == address(0) ? 0 : IERC20(paymentAsset).balanceOf(address(this));
        _payoutUserIncome(core, fromUserId, toUserId, amount, "crossline", paymentAsset, juniorPkgLevel);
        emit CrossLineIncomeRecorded(fromUserId, toUserId, amount);
        _sweepResidualToCreator(paymentAsset, balanceBefore);
    }

    event AdminDirectPayoutExecuted(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount, uint8 cyclePkgLevel);
    event AdminRemainderDistributionExecuted(uint256 indexed fromUserId, uint256 indexed sponsorId, uint256 packageAmount, uint8 cyclePkgLevel);

    // Admin-only scoped fix path: pays the sponsor directly via the escrow_direct
    // routing branch, which bypasses escrow accumulation, auto-upgrade checks,
    // and auto-rebirth checks entirely when the recipient's current package level
    // is already above cyclePkgLevel. Used only to resolve stuck failed distributions
    // without touching normal registration/upgrade/rebirth flows.
    function adminDirectPayout(
        uint256 fromUserId,
        uint256 toUserId,
        uint256 amount,
        address paymentAsset,
        uint8 cyclePkgLevel
    ) external onlyCore {
        if (amount == 0 || toUserId == 0) {
            return;
        }
        uint256 balanceBefore = paymentAsset == address(0) ? 0 : IERC20(paymentAsset).balanceOf(address(this));
        IMetaGuildXIncomeEngine(incomeEngineContract).routeIncome(
            toUserId, amount, paymentAsset, "escrow_direct", cyclePkgLevel
        );
        emit AdminDirectPayoutExecuted(fromUserId, toUserId, amount, cyclePkgLevel);
        _sweepResidualToCreator(paymentAsset, balanceBefore);
    }

    // Admin-only scoped fix path: distributes the remainder of a stuck failed
    // distribution (level income across the upline, cashback, and creator fee)
    // through the exact same internal routines used by the live, normal
    // registration flow (_distributeLevelIncome, Core.routeCashbackCreatorRemainder).
    // No bypass logic here - the system's own X-slot/escrow/rebirth eligibility
    // checks run exactly as they would in a normal registration, so any rebirth
    // that should naturally trigger as part of this distribution still triggers.
    function adminRemainderDistribution(
        uint256 fromUserId,
        uint256 sponsorId,
        uint256 placedUnderId,
        uint8 cyclePkgLevel,
        uint256 packageAmount,
        address paymentAsset,
        uint256 originalUserId
    ) external onlyCore whenNotPaused {
        uint256 balanceBefore = paymentAsset == address(0) ? 0 : IERC20(paymentAsset).balanceOf(address(this));
        _distributeLevelIncome(
            fromUserId, sponsorId, placedUnderId, cyclePkgLevel, packageAmount, paymentAsset, originalUserId
        );
        IIncomeSystemCore(coreContract).routeCashbackCreatorRemainder(packageAmount, paymentAsset);
        emit AdminRemainderDistributionExecuted(fromUserId, sponsorId, packageAmount, cyclePkgLevel);
        _sweepResidualToCreator(paymentAsset, balanceBefore);
    }

    function directIncomeBps() external pure returns (uint256) {
        return DIRECT_INCOME_BPS;
    }

    function levelIncomeBps() external pure returns (uint256) {
        return LEVEL_INCOME_BPS;
    }

    function cashbackBps() external pure returns (uint256) {
        return CASHBACK_BPS;
    }

    function creatorFeeBps() external pure returns (uint256) {
        return CREATOR_FEE_BPS;
    }

    function _distributeLevelIncome(
        uint256 fromUserId,
        uint256 sponsorId,
        uint256 placedUnderId,
        uint8 juniorPkgLevel,
        uint256 /* businessAmount */,
        address paymentAsset,
        uint256 /* originalUserId */
    ) internal {
        IIncomeSystemCore core = IIncomeSystemCore(coreContract);
        uint256 juniorPrice = core.getPackagePriceByLevel(juniorPkgLevel);
        uint256 baseLevelAmount = _calculateBps(juniorPrice, LEVEL_INCOME_BPS);
        uint256 totalLevelBudget = baseLevelAmount * MAX_LEVELS;
        uint256 distributed;

        // paidIds size must equal MAX_LEVELS (currently 10) - update both if MAX_LEVELS changes
        uint256[10] memory paidIds;
        uint8 paidCount = 0;
        uint256 placementCursor = placedUnderId;

        for (uint8 level = 1; level <= MAX_LEVELS;) {
            uint256 candidateId;

            if (level == 1) {
                candidateId = sponsorId;
            } else {
                uint256 genealogyCandidate =
                    _findEligibleGenealogyUpline(core, sponsorId, juniorPkgLevel, level, paidIds, paidCount);
                if (genealogyCandidate != 0) {
                    uint256 genealogyPayout = baseLevelAmount;
                    _payoutUserIncome(
                        core, fromUserId, genealogyCandidate, genealogyPayout, "level", paymentAsset, juniorPkgLevel
                    );
                    distributed += genealogyPayout;
                    emit LevelIncomeRecorded(fromUserId, genealogyCandidate, level, genealogyPayout, juniorPkgLevel);

                    if (paidCount < 10) {
                        paidIds[paidCount++] = genealogyCandidate;
                    }

                    level++;
                    continue;
                }

                uint8 safety = 20;
                while (placementCursor != 0 && safety > 0) {
                    bool alreadyPaid = false;
                    for (uint8 p = 0; p < paidCount; p++) {
                        if (paidIds[p] == placementCursor) {
                            alreadyPaid = true;
                            break;
                        }
                    }

                    if (!alreadyPaid) {
                        break;
                    }

                    uint256 nextCursor = core.getLevelParent(placementCursor);
                    if (nextCursor == 0) {
                        nextCursor = core.getBinaryParent(placementCursor);
                    }
                    placementCursor = nextCursor;
                    safety--;
                }
                candidateId = placementCursor;
            }

            if (candidateId == 0) {
                break;
            }

            if (!core.isLevelEligibleUser(candidateId)) {
                emit LevelIncomeSkipped(candidateId, fromUserId, level, paymentAsset, baseLevelAmount, block.timestamp);
                if (level > 1) {
                    uint256 next = core.getLevelParent(placementCursor);
                    if (next == 0) {
                        next = core.getBinaryParent(placementCursor);
                    }
                    placementCursor = next;
                }
                continue;
            }

            uint8 uplinePkgLevel = _getUserPackageLevel(core, candidateId);
            uint8 unlockedLevels = _getUnlockedLevels(core, candidateId, juniorPkgLevel);

            if (uplinePkgLevel < juniorPkgLevel) {
                emit LevelIncomeSkipped(candidateId, fromUserId, level, paymentAsset, baseLevelAmount, block.timestamp);
                uint256 next;
                if (level == 1) {
                    next = core.getLevelParent(sponsorId);
                    if (next == 0) {
                        next = core.getBinaryParent(sponsorId);
                    }
                } else {
                    next = core.getLevelParent(candidateId);
                    if (next == 0) {
                        next = core.getBinaryParent(candidateId);
                    }
                }
                placementCursor = next;
                level++;
                continue;
            }

            if (unlockedLevels < level) {
                uint256 spilloverReceiver =
                    _findEligibleLevelUpline(core, candidateId, juniorPkgLevel, level, paidIds, paidCount);
                if (spilloverReceiver != 0) {
                    uint256 spilloverPayout = baseLevelAmount;
                    _payoutUserIncome(
                        core, fromUserId, spilloverReceiver, spilloverPayout, "spillover", paymentAsset, juniorPkgLevel
                    );
                    distributed += spilloverPayout;
                    emit SpilloverIncome(spilloverReceiver, spilloverPayout, level);
                    // FIX 1: Add spillover receiver to paidIds to prevent duplicate payment
                    if (paidCount < 10) {
                        paidIds[paidCount++] = spilloverReceiver;
                    }
                } else {
                    emit LevelIncomeSkipped(candidateId, fromUserId, level, paymentAsset, baseLevelAmount, block.timestamp);
                }
                // FIX 2: Advance placementCursor after spillover so next level starts fresh
                uint256 nextCursor = core.getLevelParent(candidateId);
                if (nextCursor == 0) {
                    nextCursor = core.getBinaryParent(candidateId);
                }
                placementCursor = nextCursor;
                level++;
                continue;
            }

            uint256 payout = baseLevelAmount;
            _payoutUserIncome(core, fromUserId, candidateId, payout, "level", paymentAsset, juniorPkgLevel);
            distributed += payout;
            emit LevelIncomeRecorded(fromUserId, candidateId, level, payout, juniorPkgLevel);

            if (paidCount < 10) {
                paidIds[paidCount++] = candidateId;
            }

            level++;
        }

        if (totalLevelBudget > distributed) {
            _routeCreatorFallbackIncome(core, fromUserId, totalLevelBudget - distributed, "level", paymentAsset);
        }
    }

    function _routeCreatorFallbackIncome(
        IIncomeSystemCore core,
        uint256 fromUserId,
        uint256 amount,
        string memory incomeType,
        address paymentAsset
    ) internal {
        if (amount == 0) {
            return;
        }

        core.routeCreatorFallbackIncome(fromUserId, amount, incomeType, paymentAsset, creatorWallet);
    }

    function _payoutUserIncome(
        IIncomeSystemCore core,
        uint256 fromUserId,
        uint256 toUserId,
        uint256 amount,
        string memory incomeTypeLabel,
        address paymentAsset,
        uint8 cyclePkgLevel
    ) internal {
        if (amount == 0) {
            return;
        }
        if (toUserId == 0) {
            _routeCreatorFallbackIncome(core, fromUserId, amount, incomeTypeLabel, paymentAsset);
            return;
        }

        address userWallet = _getUserWallet(core, toUserId);
        if (userWallet == address(0)) {
            _routeCreatorFallbackIncome(core, fromUserId, amount, incomeTypeLabel, paymentAsset);
            return;
        }

        uint8 sponsorPkgLevel = _getUserPackageLevel(core, toUserId);
        if (sponsorPkgLevel == 0) {
            _routeCreatorFallbackIncome(core, fromUserId, amount, incomeTypeLabel, paymentAsset);
            return;
        }

        IMetaGuildXIncomeEngine(incomeEngineContract).routeIncome(
            toUserId, amount, paymentAsset, incomeTypeLabel, cyclePkgLevel
        );
    }

    function _getUserWallet(IIncomeSystemCore core, uint256 userId) internal view returns (address wallet) {
        (, wallet, , , , , , , , , , , ) = core.usersById(userId);
    }

    function _isLevelUnlocked(IIncomeSystemCore core, uint256 userId, uint8 juniorPkgLevel, uint8 level) internal view returns (bool) {
        uint8 unlockedLevels = _getUnlockedLevels(core, userId, juniorPkgLevel);
        return unlockedLevels >= level;
    }

    function _getUnlockedLevels(IIncomeSystemCore core, uint256 userId, uint8 packageLevel) internal view returns (uint8) {
        uint256 packageUnlock = _countJuniorsWithPackage(core, userId, packageLevel) * 2;
        if (packageUnlock > MAX_LEVELS) {
            packageUnlock = MAX_LEVELS;
        }

        return uint8(packageUnlock);
    }

    function _countJuniorsWithPackage(IIncomeSystemCore core, uint256 userId, uint8 packageLevel) internal view returns (uint256) {
        return core.referralCountByPkg(userId, packageLevel);
    }

    function _findEligibleGenealogyUpline(
        IIncomeSystemCore core,
        uint256 start,
        uint8 juniorPkgLevel,
        uint8 level,
        uint256[10] memory paidIds,
        uint8 paidCount
    ) internal view returns (uint256) {
        uint256 current = start;

        for (uint8 i = 0; i < MAX_SEARCH_DEPTH; i++) {
            if (current == 0) {
                break;
            }

            if (core.isLevelEligibleUser(current)) {
                bool alreadyPaid = false;
                for (uint8 p = 0; p < paidCount; p++) {
                    if (paidIds[p] == current) {
                        alreadyPaid = true;
                        break;
                    }
                }

                if (!alreadyPaid) {
                    uint8 uplinePkgLevel = _getUserPackageLevel(core, current);
                    if (uplinePkgLevel >= juniorPkgLevel) {
                        uint8 unlockedLevels = _getUnlockedLevels(core, current, juniorPkgLevel);
                        if (unlockedLevels >= level) {
                            return current;
                        }
                    }
                }
            }

            current = core.getUserSponsorId(current);
        }

        return 0;
    }

    function _findEligibleLevelUpline(
        IIncomeSystemCore core,
        uint256 start,
        uint8 juniorPkgLevel,
        uint8 level,
        uint256[10] memory paidIds,
        uint8 paidCount
    ) internal view returns (uint256) {
        uint256 current = start;

        for (uint8 i = 0; i < MAX_SEARCH_DEPTH; i++) {
            if (current == 0) {
                break;
            }

            if (core.isLevelEligibleUser(current)) {
                bool alreadyPaid = false;
                for (uint8 p = 0; p < paidCount; p++) {
                    if (paidIds[p] == current) {
                        alreadyPaid = true;
                        break;
                    }
                }

                if (!alreadyPaid) {
                    uint8 uplinePkgLevel = _getUserPackageLevel(core, current);
                    if (uplinePkgLevel >= juniorPkgLevel) {
                        uint8 unlockedLevels = _getUnlockedLevels(core, current, juniorPkgLevel);
                        if (unlockedLevels >= level) {
                            return current;
                        }
                    }
                }
            }

            uint256 nextLevel = core.getLevelParent(current);
            if (nextLevel == 0) nextLevel = core.getBinaryParent(current);
            current = nextLevel;
        }

        return 0;
    }

    function _getUserPackageLevel(IIncomeSystemCore core, uint256 userId) internal view returns (uint8 packageLevel) {
        (, , , packageLevel, , , , , , , , , ) = core.usersById(userId);
    }

    function _calculateBps(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return (amount * bps) / 10_000;
    }

    function _sweepResidualToCreator(
        address paymentAsset,
        uint256 balanceBefore
    ) internal {
        if (paymentAsset == address(0) || creatorWallet == address(0)) {
            return;
        }
        uint256 balanceAfter = IERC20(paymentAsset).balanceOf(address(this));
        if (balanceAfter > balanceBefore) {
            uint256 excess = balanceAfter - balanceBefore;
            _safeTransferExact(
                paymentAsset,
                creatorWallet,
                excess,
                "SWEEP_FAILED"
            );
            emit ResidualSweptToCreator(excess);
        }
    }

    function _safeTransferExact(address token, address recipient, uint256 amount, string memory errorMessage) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), errorMessage);
    }

    function _validateContract(address target) internal view {
        require(target != address(0), "Invalid contract");
        require(target.code.length > 0, "Target is not a contract");
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // Upgrade-safe: new variables must be appended at the end of storage.
    address public creatorWallet;
    address public incomeEngineContract;
    uint256[46] private __gap;
}
