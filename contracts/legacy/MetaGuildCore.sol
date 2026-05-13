// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./libraries/MGXTypes.sol";

contract MetaGuildCore is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using MGXTypes for MGXTypes.UserProfile;

    uint256[] internal packagePrices;
    uint256 public nextUserId;

    mapping(uint256 => MGXTypes.UserProfile) public usersById;
    mapping(address => uint256) public userIdByAddress;

    address public binaryTreeContract;
    address public incomeContract;
    address public cashbackContract;
    address public upgradeManagerContract;

    event UserRegistered(uint256 indexed userId, address indexed account, uint8 packageLevel, uint256 amount);
    event PackageUpgraded(uint256 indexed userId, uint8 fromLevel, uint8 toLevel, uint256 amount);
    event BinaryTreeContractSet(address indexed binaryTreeContractAddress);
    event IncomeContractSet(address indexed incomeContractAddress);
    event CashbackContractSet(address indexed cashbackContractAddress);
    event UpgradeManagerContractSet(address indexed upgradeManagerContractAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);

        packagePrices.push(100);
        packagePrices.push(200);
        packagePrices.push(400);
        packagePrices.push(800);
        packagePrices.push(1600);
        packagePrices.push(3200);
        packagePrices.push(6400);
        packagePrices.push(12800);
        packagePrices.push(25600);
        packagePrices.push(51200);

        nextUserId = 1;
    }

    function setBinaryTreeContract(address binaryTreeContractAddress) external onlyOwner {
        _validateContract(binaryTreeContractAddress);
        binaryTreeContract = binaryTreeContractAddress;
        emit BinaryTreeContractSet(binaryTreeContractAddress);
    }

    function setIncomeContract(address incomeContractAddress) external onlyOwner {
        _validateContract(incomeContractAddress);
        incomeContract = incomeContractAddress;
        emit IncomeContractSet(incomeContractAddress);
    }

    function setCashbackContract(address cashbackContractAddress) external onlyOwner {
        _validateContract(cashbackContractAddress);
        cashbackContract = cashbackContractAddress;
        emit CashbackContractSet(cashbackContractAddress);
    }

    function setUpgradeManagerContract(address upgradeManagerContractAddress) external onlyOwner {
        _validateContract(upgradeManagerContractAddress);
        upgradeManagerContract = upgradeManagerContractAddress;
        emit UpgradeManagerContractSet(upgradeManagerContractAddress);
    }

    function register(address account, uint8 packageLevel) external virtual returns (uint256 userId) {
        require(account != address(0), "Invalid account");
        require(userIdByAddress[account] == 0, "Already registered");
        require(packageLevel > 0 && packageLevel <= packagePrices.length, "Invalid package");

        userId = nextUserId++;
        uint256 amount = packagePrices[packageLevel - 1];

        usersById[userId] = MGXTypes.UserProfile({
            id: userId,
            account: account,
            sponsorId: 0,
            packageLevel: packageLevel,
            totalContribution: amount,
            totalEarnings: 0,
            directReferrals: 0,
            totalTeamBusiness: 0,
            rebirthCount: 0,
            xCount: 0,
            joinedAt: block.timestamp,
            surrendered: false
        });

        userIdByAddress[account] = userId;
        emit UserRegistered(userId, account, packageLevel, amount);
    }

    function upgradePackage(uint256 userId, uint8 newPackageLevel) external virtual {
        MGXTypes.UserProfile storage profile = usersById[userId];
        require(profile.id != 0, "User not found");
        require(newPackageLevel > profile.packageLevel && newPackageLevel <= packagePrices.length, "Invalid upgrade");

        uint8 oldLevel = profile.packageLevel;
        uint256 amount = packagePrices[newPackageLevel - 1];
        profile.packageLevel = newPackageLevel;
        profile.totalContribution += amount;

        emit PackageUpgraded(userId, oldLevel, newPackageLevel, amount);
    }

    function getPackagePrices() external view returns (uint256[] memory) {
        return packagePrices;
    }

    function _validateContract(address target) internal view {
        require(target != address(0), "Invalid contract");
        require(target.code.length > 0, "Target is not a contract");
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[50] private __gap;
}
