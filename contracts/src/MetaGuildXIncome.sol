// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./utils/MetaGuildReentrancyGuardUpgradeable.sol";

interface IMetaGuildXIncomeCore {
    function getUserPackageLevel(uint256 userId) external view returns (uint256);
    function getUserOriginalPackageLevel(uint256 userId) external view returns (uint8);
    function getPackagePriceByLevel(uint256 level) external view returns (uint256);
    function manuallyUpgraded(uint256 userId) external view returns (bool);
    function payoutUserIncome(uint256 userId, uint256 amount, address paymentAsset) external;
}

interface IMetaGuildXIncomeUpgrade {
    function getRebirthIds(uint256 userId) external view returns (uint256[] memory);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IMetaGuildXUpgradeEngine {
    function checkAndTriggerUpgrade(uint256 userId, uint256 pkgPrice, address paymentAsset) external;
    function checkAndTriggerRebirth(uint256 userId, address paymentAsset) external returns (bool);
}

contract MetaGuildXIncome is Initializable, UUPSUpgradeable, OwnableUpgradeable, MetaGuildReentrancyGuardUpgradeable {
    address public coreContract;
    address public incomeRouterContract;
    address public upgradeEngineContract;
    address public defaultPaymentAsset;

    struct IncomeInfo {
        uint256 direct;
        uint256 level;
        uint256 spillover;
        uint256 crossline;
    }

    mapping(uint256 => mapping(uint256 => uint256)) public escrowBalances;
    mapping(uint256 => mapping(uint256 => uint256)) public totalEarnings;
    mapping(uint256 => IncomeInfo) public incomesByUser;
    mapping(uint256 => uint256) public rebirthEscrow;
    mapping(uint256 => mapping(uint256 => uint256)) public walletEarnings;

    event DirectPayout(uint256 indexed userId, uint256 amount, uint256 xSlot);
    event EscrowCredited(uint256 indexed userId, uint256 amount, uint256 xSlot);
    event EscrowReleased(uint256 indexed userId, uint256 amount);
    event RebirthEscrowReleased(uint256 indexed userId, uint256 amount);
    event AdminEscrowReleased(uint256 indexed userId, uint256 amount);
    event AdminEscrowAdded(uint256 indexed userId, uint256 amount);
    event StrandedEscrowReleased(uint256 indexed userId, uint256 pkgLevel, uint256 amount);
    event IncomeReset(uint256 indexed userId);
    event AdminEarningsBackfilled(
        uint256 indexed userId,
        uint256 pkgLevel,
        uint256 earningsAmount,
        uint256 rebirthAmount
    );

    modifier onlyRouter() {
        require(msg.sender == incomeRouterContract, "Only router");
        _;
    }

    modifier onlyUpgradeEngine() {
        require(
            msg.sender == upgradeEngineContract || msg.sender == coreContract,
            "Only upgrade engine or core"
        );
        _;
    }

    modifier onlyCore() {
        require(msg.sender == coreContract, "Only core");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address core_,
        address router_,
        address upgradeEngine_,
        address paymentAsset_
    ) external initializer {
        __Ownable_init(msg.sender);
        __MetaGuildReentrancyGuard_init();

        coreContract = core_;
        incomeRouterContract = router_;
        upgradeEngineContract = upgradeEngine_;
        defaultPaymentAsset = paymentAsset_;
    }

    function routeIncome(uint256 userId, uint256 amount, address asset, string calldata incomeType, uint8 cyclePkgLevel)
        external
        onlyRouter
    {
        if (userId == 0 || amount == 0) {
            return;
        }

        IMetaGuildXIncomeCore core = IMetaGuildXIncomeCore(coreContract);
        if (cyclePkgLevel == 0) {
            return;
        }

        uint256 packagePrice = core.getPackagePriceByLevel(cyclePkgLevel);
        if (packagePrice == 0) {
            return;
        }

        bytes32 incomeKey = keccak256(bytes(incomeType));
        bytes32 crosslineKey = keccak256("crossline");

        if (incomeKey == crosslineKey) {
            _updateStats(userId, amount, incomeType);
            return;
        }

        bool isEscrowDirect = incomeKey == keccak256("escrow_direct");
        uint256 pkgLevel = cyclePkgLevel;
        uint256 effectivePackagePrice = packagePrice;
        // escrow_direct uses cyclePkgLevel (junior's package)
        // same as regular income paths, so the bucket tracks
        // the junior's package level consistently.

        uint256 totalBefore = totalEarnings[userId][pkgLevel];
        _updateStats(userId, amount, incomeType);
        totalEarnings[userId][pkgLevel] = totalBefore + amount;

        address paymentAsset = asset == address(0) ? defaultPaymentAsset : asset;

        if (isEscrowDirect) {
            uint256 escrowXSlot = effectivePackagePrice == 0 ? 0 : totalBefore / effectivePackagePrice;
            escrowBalances[userId][pkgLevel] += amount;
            emit EscrowCredited(userId, amount, escrowXSlot);
            _runPostRoutingUpgradeCheck(core, userId, pkgLevel, effectivePackagePrice, paymentAsset);
            return;
        }

        uint256 escrowBefore = escrowBalances[userId][pkgLevel];
        uint256 bucketReceived = totalBefore > escrowBefore
            ? totalBefore - escrowBefore : 0;
        uint256 xSlot = bucketReceived / effectivePackagePrice;

        uint256 zoneEnd = (xSlot + 1) * effectivePackagePrice;
        uint256 remaining = zoneEnd - bucketReceived;

        if (amount <= remaining) {
            _routeToZone(userId, pkgLevel, amount, xSlot, effectivePackagePrice, paymentAsset);
        } else {
            uint256 firstPart = remaining;
            uint256 secondPart = amount - remaining;
            _routeToZone(userId, pkgLevel, firstPart, xSlot, effectivePackagePrice, paymentAsset);
            uint256 nextXSlot = xSlot + 1;
            _routeToZone(
                userId,
                pkgLevel,
                secondPart,
                nextXSlot,
                effectivePackagePrice,
                paymentAsset
            );
        }

        _runPostRoutingUpgradeCheck(core, userId, pkgLevel, effectivePackagePrice, paymentAsset);
    }

    function _payoutDirectToWallet(
        IMetaGuildXIncomeCore core,
        uint256 userId,
        uint256 amount,
        address paymentAsset,
        uint256 xSlot
    ) internal {
        core.payoutUserIncome(userId, amount, paymentAsset);
        emit DirectPayout(userId, amount, xSlot);
    }

    function _routeToZone(
        uint256 userId,
        uint256 pkgLevel,
        uint256 amount,
        uint256 xSlot,
        uint256 packagePrice,
        address paymentAsset
    ) internal {
        IMetaGuildXIncomeCore core = IMetaGuildXIncomeCore(coreContract);

        if (xSlot == 0 || xSlot == 3) {
            _payoutDirectToWallet(core, userId, amount, paymentAsset, xSlot);
            return;
        }

        if (xSlot == 1 || xSlot == 2) {
            uint256 currentUserPackageLevel = core.getUserPackageLevel(userId);
            bool isManualUpgrade = IMetaGuildXIncomeCore(coreContract).manuallyUpgraded(userId);
            if (currentUserPackageLevel > pkgLevel && isManualUpgrade) {
                _payoutDirectToWallet(core, userId, amount, paymentAsset, xSlot);
                return;
            }
            escrowBalances[userId][pkgLevel] += amount;
            emit EscrowCredited(userId, amount, xSlot);
            _runPostRoutingUpgradeCheck(core, userId, pkgLevel, packagePrice, paymentAsset);
            return;
        }

        bool isRebirthEligible =
            pkgLevel == 1
            && core.getUserOriginalPackageLevel(userId) == 1
            && IMetaGuildXIncomeUpgrade(upgradeEngineContract).getRebirthIds(userId).length == 0;
        if (isRebirthEligible) {
            rebirthEscrow[userId] += amount;
            emit EscrowCredited(userId, amount, xSlot);
            IMetaGuildXUpgradeEngine(upgradeEngineContract).checkAndTriggerRebirth(userId, paymentAsset);
            return;
        }

        _payoutDirectToWallet(core, userId, amount, paymentAsset, xSlot);
    }

    function _runPostRoutingUpgradeCheck(
        IMetaGuildXIncomeCore core,
        uint256 userId,
        uint256 pkgLevel,
        uint256 packagePrice,
        address paymentAsset
    ) internal {
        if (packagePrice == 0) {
            return;
        }

        if (core.getUserPackageLevel(userId) != pkgLevel) {
            return;
        }

        uint256 totalEscrowForPackage = escrowBalances[userId][pkgLevel];
        uint256 upgradeThreshold = packagePrice * 2;
        if (totalEscrowForPackage < upgradeThreshold) {
            return;
        }

        IMetaGuildXUpgradeEngine(upgradeEngineContract).checkAndTriggerUpgrade(userId, packagePrice, paymentAsset);
    }

    function releaseEscrow(uint256 userId, uint256 amount) external onlyUpgradeEngine {
        uint256 pkgLevel = IMetaGuildXIncomeCore(coreContract).getUserPackageLevel(userId);
        require(escrowBalances[userId][pkgLevel] >= amount, "Insufficient escrow");
        escrowBalances[userId][pkgLevel] -= amount;
        emit EscrowReleased(userId, amount);
    }

    function releaseEscrowByPkg(uint256 userId, uint8 pkgLevel, uint256 amount) external onlyUpgradeEngine {
        require(escrowBalances[userId][pkgLevel] >= amount, "Insufficient escrow");
        escrowBalances[userId][pkgLevel] -= amount;
        emit EscrowReleased(userId, amount);
    }

    function releaseAllEscrow(uint256 userId, uint256 amount) external onlyUpgradeEngine {
        uint256 remaining = amount;
        for (uint8 i = 1; i <= 10; i++) {
            if (remaining == 0) break;
            uint256 bal = escrowBalances[userId][i];
            if (bal == 0) continue;
            uint256 deduct = bal >= remaining ? remaining : bal;
            escrowBalances[userId][i] -= deduct;
            remaining -= deduct;
        }
        emit EscrowReleased(userId, amount - remaining);
    }

    function releaseStrandedEscrow(uint256 userId, address paymentAsset) external onlyCore {
        IMetaGuildXIncomeCore core = IMetaGuildXIncomeCore(coreContract);
        uint256 currentPkg = core.getUserPackageLevel(userId);
        address asset = paymentAsset == address(0) ? defaultPaymentAsset : paymentAsset;

        for (uint256 pkg = 1; pkg < currentPkg; pkg++) {
            uint256 strandedAmount = escrowBalances[userId][pkg];
            if (strandedAmount == 0) {
                continue;
            }

            escrowBalances[userId][pkg] = 0;
            core.payoutUserIncome(userId, strandedAmount, asset);
            emit StrandedEscrowReleased(userId, pkg, strandedAmount);
        }
    }

    function resetIncome(uint256 userId) external onlyUpgradeEngine {
        uint256 pkgLevel = IMetaGuildXIncomeCore(coreContract).getUserPackageLevel(userId);
        totalEarnings[userId][pkgLevel] = 0;
        emit IncomeReset(userId);
    }

    function releaseRebirthEscrow(uint256 userId) external onlyUpgradeEngine {
        uint256 amount = rebirthEscrow[userId];
        if (amount == 0) return;
        rebirthEscrow[userId] = 0;
        IMetaGuildXIncomeCore(coreContract).payoutUserIncome(userId, amount, defaultPaymentAsset);
        emit RebirthEscrowReleased(userId, amount);
    }

    function clearRebirthEscrow(uint256 userId) external onlyUpgradeEngine {
        uint256 amount = rebirthEscrow[userId];
        if (amount == 0) return;
        rebirthEscrow[userId] = 0;
        emit RebirthEscrowReleased(userId, amount);
    }

    function getRebirthEscrow(uint256 userId) external view returns (uint256) {
        return rebirthEscrow[userId];
    }

    function getEscrow(uint256 userId) external view returns (uint256) {
        uint256 pkgLevel = IMetaGuildXIncomeCore(coreContract).getUserPackageLevel(userId);
        return escrowBalances[userId][pkgLevel];
    }

    function getTotalEscrow(uint256 userId) external view returns (uint256) {
        uint256 total = 0;
        for (uint8 i = 1; i <= 10; i++) {
            total += escrowBalances[userId][i];
        }
        total += rebirthEscrow[userId];
        return total;
    }

    function getTotalIncome(uint256 userId) external view returns (uint256) {
        uint256 pkgLevel = IMetaGuildXIncomeCore(coreContract).getUserPackageLevel(userId);
        return totalEarnings[userId][pkgLevel];
    }

    function getTotalAllIncome(uint256 userId) external view returns (uint256) {
        uint256 total = 0;
        for (uint8 i = 1; i <= 10; i++) {
            total += totalEarnings[userId][i];
        }
        return total;
    }

    function setCoreContract(address target) external onlyOwner {
        coreContract = target;
    }

    function setIncomeRouterContract(address target) external onlyOwner {
        incomeRouterContract = target;
    }

    function setUpgradeEngineContract(address target) external onlyOwner {
        upgradeEngineContract = target;
    }

    function setDefaultPaymentAsset(address target) external onlyOwner {
        defaultPaymentAsset = target;
    }

    function adminReleaseEscrow(uint256 userId, uint256 amount) external onlyOwner {
        IMetaGuildXIncomeCore core = IMetaGuildXIncomeCore(coreContract);
        uint256 pkgLevel = core.getUserPackageLevel(userId);

        uint256 currentEscrow = escrowBalances[userId][pkgLevel];
        require(currentEscrow >= amount, "Insufficient escrow");

        escrowBalances[userId][pkgLevel] -= amount;
        address asset = defaultPaymentAsset;
        IERC20(asset).transfer(owner(), amount);

        emit AdminEscrowReleased(userId, amount);
    }

    function adminReleaseRebirthEscrow(uint256 userId, uint256 amount) external onlyOwner {
        require(rebirthEscrow[userId] >= amount, "Insufficient rebirth escrow");
        require(amount > 0, "Amount must be > 0");

        IMetaGuildXIncomeCore core = IMetaGuildXIncomeCore(coreContract);
        rebirthEscrow[userId] -= amount;
        core.payoutUserIncome(userId, amount, defaultPaymentAsset);

        emit EscrowReleased(userId, amount);
    }

    function adminReleaseEscrowByPkgToUser(uint256 userId, uint8 pkgLevel, uint256 amount) external onlyOwner {
        require(escrowBalances[userId][pkgLevel] >= amount, "Insufficient escrow");
        require(amount > 0, "Amount must be > 0");

        IMetaGuildXIncomeCore core = IMetaGuildXIncomeCore(coreContract);
        escrowBalances[userId][pkgLevel] -= amount;
        core.payoutUserIncome(userId, amount, defaultPaymentAsset);

        emit EscrowReleased(userId, amount);
    }

    function adminRestoreEscrow(uint256 userId, uint8 pkgLevel, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        escrowBalances[userId][pkgLevel] += amount;
        emit EscrowCredited(userId, amount, 0);
    }

    function adminAddEscrow(uint256 userId, uint256 amount) external onlyOwner {
        // Owner must approve this contract for `amount` on the payment token before reloading escrow.
        address asset = defaultPaymentAsset;
        IERC20(asset).transferFrom(msg.sender, address(this), amount);

        IMetaGuildXIncomeCore core = IMetaGuildXIncomeCore(coreContract);
        uint256 pkgLevel = core.getUserPackageLevel(userId);

        escrowBalances[userId][pkgLevel] += amount;
        emit AdminEscrowAdded(userId, amount);
    }

    function adminBackfillEarnings(
        uint256 userId,
        uint256 pkgLevel,
        uint256 earningsAmount,
        uint256 rebirthAmount
    ) external onlyOwner {
        totalEarnings[userId][pkgLevel] += earningsAmount;
        if (rebirthAmount > 0) {
            rebirthEscrow[userId] += rebirthAmount;
        }
        emit AdminEarningsBackfilled(userId, pkgLevel, earningsAmount, rebirthAmount);
    }

    function _updateStats(uint256 userId, uint256 amount, string calldata incomeType) internal {
        bytes32 incomeKey = keccak256(bytes(incomeType));
        if (incomeKey == keccak256("direct") || incomeKey == keccak256("escrow_direct")) {
            incomesByUser[userId].direct += amount;
        } else if (incomeKey == keccak256("level")) {
            incomesByUser[userId].level += amount;
        } else if (incomeKey == keccak256("spillover")) {
            incomesByUser[userId].spillover += amount;
        } else if (incomeKey == keccak256("crossline")) {
            incomesByUser[userId].crossline += amount;
        }
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[45] private __gap;
}
