// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IMetaGuildXCore {
    function executeUpgrade(uint256 userId, uint256 newLevel) external;
}

contract UpgradeManager is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    address public coreContract;
    mapping(uint256 => uint256) public totalIncomeReceived;
    mapping(uint256 => uint256) public currentPackageLevel;
    mapping(uint256 => uint256) public reactivationCount;

    event AutoUpgradeTriggered(uint256 indexed userId, uint8 indexed nextPackageLevel);
    event ReactivationTriggered(uint256 indexed userId, uint256 indexed newUserId, uint256 entryAmount);
    event CoreContractSet(address indexed coreContractAddress);

    modifier onlyCore() {
        require(msg.sender == coreContract, "only core");
        _;
    }

    modifier onlyCoreOrOwner() {
        require(msg.sender == coreContract || msg.sender == owner(), "only core");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
    }

    function setCoreContract(address coreContractAddress) external onlyOwner {
        _validateContract(coreContractAddress);
        coreContract = coreContractAddress;
        emit CoreContractSet(coreContractAddress);
    }

    function isEligibleForAutoUpgrade(uint256 twoXIncome, uint256 threeXIncome, uint256 packageAmount) external pure returns (bool) {
        return twoXIncome >= packageAmount * 2 && threeXIncome >= packageAmount * 3;
    }

    function isEligibleForReactivation(uint256 xCount) external pure returns (bool) {
        return xCount >= 5;
    }

    function trackIncome(uint256 userId, uint256 amount, uint256 packageLevel, uint256 packagePrice) external onlyCore {
        totalIncomeReceived[userId] += amount;
        currentPackageLevel[userId] = packageLevel;
        packagePrice;
    }

    function setPackageLevel(uint256 userId, uint256 level) external onlyCoreOrOwner {
        currentPackageLevel[userId] = level;
    }

    function resetCycle(uint256 userId) external onlyCore {
        totalIncomeReceived[userId] = 0;
        reactivationCount[userId] = 0;
    }

    function hasCompletedCycle(uint256 userId) external view returns (bool) {
        return reactivationCount[userId] >= 1;
    }

    function markCycleComplete(uint256 userId) external onlyCore {
        reactivationCount[userId] += 1;
    }

    function emitAutoUpgradeTriggered(uint256 userId, uint8 nextPackageLevel) external {
        require(msg.sender == coreContract || msg.sender == owner(), "Unauthorized");
        emit AutoUpgradeTriggered(userId, nextPackageLevel);
    }

    function emitReactivationTriggered(uint256 userId, uint256 newUserId, uint256 entryAmount) external {
        require(msg.sender == coreContract || msg.sender == owner(), "Unauthorized");
        emit ReactivationTriggered(userId, newUserId, entryAmount);
    }

    function _validateContract(address target) internal view {
        require(target != address(0), "Invalid contract");
        require(target.code.length > 0, "Target is not a contract");
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[46] private __gap;
}
