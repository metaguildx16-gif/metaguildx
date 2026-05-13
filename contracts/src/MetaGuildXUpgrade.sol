// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IMetaGuildXUpgradeCore {
    function getUserPackageLevel(uint256 userId) external view returns (uint256);
    function getUserOriginalPackageLevel(uint256 userId) external view returns (uint8);
    function getPackagePriceByLevel(uint256 level) external view returns (uint256);
    function isUserActive(uint256 userId) external view returns (bool);
    function setUserPackageLevel(uint256 userId, uint256 newLevel) external;
    function payoutUserIncome(uint256 userId, uint256 amount, address paymentAsset) external;
    function createRebirthUser(uint256 originalUserId) external returns (uint256);
    function getUserSponsorId(uint256 userId) external view returns (uint256);
    function processUpgradeFromEngine(
        uint256 userId,
        uint8 newPackageLevel,
        address paymentAsset,
        uint256 upgradeAmount
    ) external;
}

interface IMetaGuildXUpgradeIncome {
    function getEscrow(uint256 userId) external view returns (uint256);
    function getRebirthEscrow(uint256 userId) external view returns (uint256);
    function releaseEscrow(uint256 userId, uint256 amount) external;
    function releaseEscrowByPkg(uint256 userId, uint8 pkgLevel, uint256 amount) external;
    function resetIncome(uint256 userId) external;
    function releaseRebirthEscrow(uint256 userId) external;
    function clearRebirthEscrow(uint256 userId) external;
}

interface ICore2 {
    function setUserPackageLevel(uint256 userId, uint256 newLevel) external;
}

contract MetaGuildXUpgrade is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    address public coreContract;
    address public incomeContract;
    address public defaultPaymentAsset;

    mapping(uint256 => uint256[]) public rebirthIdsByUser;

    event PackageUpgraded(uint256 indexed userId, uint256 newLevel);
    event RebirthCreated(uint256 indexed originalId, uint256 indexed newId);
    event MaxLevelEscrowReleased(uint256 indexed userId, uint256 amount);

    modifier onlyIncomeContract() {
        require(msg.sender == incomeContract, "Only income contract");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address core_, address income_, address paymentAsset_) external initializer {
        __Ownable_init(msg.sender);
        coreContract = core_;
        incomeContract = income_;
        defaultPaymentAsset = paymentAsset_;
    }

    function checkAndTriggerUpgrade(uint256 userId, uint256 pkgPrice, address paymentAsset) external onlyIncomeContract {
        IMetaGuildXUpgradeIncome income = IMetaGuildXUpgradeIncome(incomeContract);
        IMetaGuildXUpgradeCore core = IMetaGuildXUpgradeCore(coreContract);
        require(core.isUserActive(userId), "USER_NOT_ACTIVE");

        uint256 escrow = income.getEscrow(userId);
        uint256 upgradeCost = pkgPrice * 2;
        if (escrow < upgradeCost) {
            return;
        }

        uint256 currentLevel = core.getUserPackageLevel(userId);
        address asset = paymentAsset == address(0) ? defaultPaymentAsset : paymentAsset;

        if (currentLevel >= 10) {
            income.releaseEscrow(userId, escrow);
            core.payoutUserIncome(userId, escrow, asset);
            emit MaxLevelEscrowReleased(userId, escrow);
            return;
        }

        uint256 totalOldEscrow = escrow;
        income.releaseEscrow(userId, upgradeCost);
        uint256 remainder = totalOldEscrow - upgradeCost;
        // resetIncome removed - cycle continues to Zone 3 and Zone 4
        core.processUpgradeFromEngine(userId, uint8(currentLevel + 1), asset, upgradeCost);
        emit PackageUpgraded(userId, currentLevel + 1);

        if (remainder > 0) {
            income.releaseEscrowByPkg(userId, uint8(currentLevel), remainder);
            core.payoutUserIncome(userId, remainder, asset);
        }
    }

    function checkAndTriggerRebirth(uint256 userId, address paymentAsset) external onlyIncomeContract returns (bool) {
        IMetaGuildXUpgradeIncome income = IMetaGuildXUpgradeIncome(incomeContract);
        IMetaGuildXUpgradeCore core = IMetaGuildXUpgradeCore(coreContract);
        // originalPackageLevel check - allows rebirth
        // even after auto-upgrade from package 1
        if (core.getUserOriginalPackageLevel(userId) != 1) {
            return false;
        }

        uint256 escrow = income.getRebirthEscrow(userId);
        uint256 pkgPrice = core.getPackagePriceByLevel(1);
        if (escrow < pkgPrice) {
            return false;
        }
        if (rebirthInProgress[userId]) {
            return false;
        }
        rebirthInProgress[userId] = true;

        address asset = paymentAsset == address(0) ? defaultPaymentAsset : paymentAsset;
        uint256 newId = core.createRebirthUser(userId);
        rebirthIdsByUser[userId].push(newId);
        emit RebirthCreated(userId, newId);
        uint256 escrowBefore = income.getRebirthEscrow(userId);
        income.resetIncome(userId);
        uint256 remaining = escrowBefore > pkgPrice ? escrowBefore - pkgPrice : 0;
        income.clearRebirthEscrow(userId);
        if (remaining > 0) {
            core.payoutUserIncome(userId, remaining, asset);
        }
        rebirthInProgress[userId] = false;
        return true;
    }

    function getRebirthIds(uint256 userId) external view returns (uint256[] memory) {
        return rebirthIdsByUser[userId];
    }

    function setCoreContract(address target) external onlyOwner {
        coreContract = target;
    }

    function setIncomeContract(address target) external onlyOwner {
        incomeContract = target;
    }

    function setDefaultPaymentAsset(address target) external onlyOwner {
        defaultPaymentAsset = target;
    }

    function setRouterContract(address target) external onlyOwner {
        require(target != address(0), "Invalid router");
        routerContract = target;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    address public routerContract;
    mapping(uint256 => bool) public rebirthInProgress;
    uint256[45] private __gap;
}
