// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./utils/MetaGuildReentrancyGuardUpgradeable.sol";

interface ISystemCashbackCore {
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
    function userPrimaryAsset(uint256 userId) external view returns (address);
    function defaultPaymentAsset() external view returns (address);
    function productionMode() external view returns (bool);
    function payoutUserIncome(uint256 userId, uint256 amount, address paymentAsset) external;
    function finalizeCashbackSurrender(
        uint256 userId,
        address paymentAsset
    ) external returns (uint256 platformAmount, uint256 settlementAmount);
}

contract CashbackPool is Initializable, UUPSUpgradeable, OwnableUpgradeable, MetaGuildReentrancyGuardUpgradeable {
    uint256 public constant JOIN_FEE_SHARE_BPS = 400;
    uint256 private constant CASHBACK_SCALAR = 1e18;

    mapping(uint256 => bool) public surrendered;
    mapping(uint256 => uint256) public cashbackClaimDebtByUser;
    mapping(address => uint256) public cashbackPoolBalanceByAsset;
    mapping(address => uint256) public cashbackPoolSettlementBalanceByAsset; // deprecated, kept for storage compatibility
    mapping(address => uint256) public cashbackPerSurrenderedScaledByAsset;
    mapping(address => uint256) public cashbackPerSurrenderedSettlementScaledByAsset;
    mapping(address => uint256) public cashbackDustScaledByAsset;
    mapping(address => uint256) public cashbackSettlementDustScaledByAsset;
    mapping(uint256 => mapping(address => uint256)) public cashbackClaimDebtByUserAsset;
    mapping(uint256 => mapping(address => uint256)) public cashbackSettlementClaimDebtByUserAsset;

    address public coreContract;
    uint256 public cashbackPoolBalance;
    uint256 public cashbackPerSurrenderedScaled;
    uint256 public cashbackDustScaled;
    uint256 public totalSurrenderedUsers;

    event UserSurrendered(uint256 indexed userId, uint256 timestamp);
    event CashbackAccrued(address indexed paymentAsset, uint256 platformAmount, uint256 settlementAmount);
    event CashbackDistributed(uint256 totalAmount, uint256 usersCount, uint256 amountPerUser);
    event CashbackClaimed(uint256 indexed userId, address indexed paymentAsset, uint256 amount, uint256 settlementAmount);
    event ForfeitureReceived(uint256 indexed userId, address indexed asset, uint256 amount);
    event CoreContractSet(address indexed coreContractAddress);
    event PaymentAssetSet(address indexed asset);

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
        __MetaGuildReentrancyGuard_init();
    }

    function setCoreContract(address coreContractAddress) external onlyOwner {
        _validateContract(coreContractAddress);
        coreContract = coreContractAddress;
        emit CoreContractSet(coreContractAddress);
    }

    function setPaymentAsset(address asset) external onlyOwner {
        require(asset != address(0), "Invalid asset");
        paymentAsset = asset;
        emit PaymentAssetSet(asset);
    }

    function notifyCashbackAccrued(
        uint256 platformAmount,
        address _asset,
        uint256 settlementAmount
    ) external onlyCore nonReentrant {
        require(platformAmount > 0, "Invalid amount");

        uint256 cashbackShareScaled = (platformAmount * JOIN_FEE_SHARE_BPS * CASHBACK_SCALAR) / 10_000;
        if (_asset != address(0)) {
            cashbackPoolBalanceByAsset[_asset] += cashbackShareScaled / CASHBACK_SCALAR;
            cashbackDustScaledByAsset[_asset] += cashbackShareScaled % CASHBACK_SCALAR;
            if (cashbackDustScaledByAsset[_asset] >= CASHBACK_SCALAR) {
                cashbackPoolBalanceByAsset[_asset] += cashbackDustScaledByAsset[_asset] / CASHBACK_SCALAR;
                cashbackDustScaledByAsset[_asset] = cashbackDustScaledByAsset[_asset] % CASHBACK_SCALAR;
            }

        } else {
            cashbackPoolBalance += cashbackShareScaled / CASHBACK_SCALAR;
            cashbackDustScaled += cashbackShareScaled % CASHBACK_SCALAR;
            if (cashbackDustScaled >= CASHBACK_SCALAR) {
                cashbackPoolBalance += cashbackDustScaled / CASHBACK_SCALAR;
                cashbackDustScaled = cashbackDustScaled % CASHBACK_SCALAR;
            }
        }

        emit CashbackAccrued(_asset, platformAmount, settlementAmount);
    }

    function surrenderForCashback(address caller, uint256 userId) external onlyCore nonReentrant {
        ISystemCashbackCore core = ISystemCashbackCore(coreContract);
        (, address account, , , , , , , , , , uint256 joinedAt, ) = core.usersById(userId);

        require(account != address(0), "User not found");
        require(account == caller, "Not your account");
        require(block.timestamp >= joinedAt + 90 days, "Surrender not available yet");
        require(block.timestamp <= joinedAt + 180 days, "Surrender window expired");

        address primaryAsset = core.userPrimaryAsset(userId);
        address defaultAsset = core.defaultPaymentAsset();
        _markSurrendered(userId, primaryAsset, defaultAsset);
    }

    function _markSurrendered(uint256 userId, address primaryAsset, address defaultAsset) internal {
        require(userId != 0, "Invalid user");
        require(!surrendered[userId], "Already surrendered");

        surrendered[userId] = true;
        totalSurrenderedUsers += 1;
        cashbackClaimDebtByUser[userId] = cashbackPerSurrenderedScaled;

        if (primaryAsset != address(0)) {
            cashbackClaimDebtByUserAsset[userId][primaryAsset] = cashbackPerSurrenderedScaledByAsset[primaryAsset];
            cashbackSettlementClaimDebtByUserAsset[userId][primaryAsset] =
                cashbackPerSurrenderedSettlementScaledByAsset[primaryAsset];
        }

        if (defaultAsset != address(0) && defaultAsset != primaryAsset) {
            cashbackClaimDebtByUserAsset[userId][defaultAsset] = cashbackPerSurrenderedScaledByAsset[defaultAsset];
            cashbackSettlementClaimDebtByUserAsset[userId][defaultAsset] =
                cashbackPerSurrenderedSettlementScaledByAsset[defaultAsset];
        }

        emit UserSurrendered(userId, block.timestamp);
    }

    function _receiveForfeiture(
        uint256 userId,
        address _asset,
        uint256 platformAmount,
        uint256 settlementAmount
    ) internal {
        if (platformAmount == 0) return;

        if (_asset != address(0)) {
            cashbackPoolBalanceByAsset[_asset] += platformAmount;
        } else {
            cashbackPoolBalance += platformAmount;
        }

        emit ForfeitureReceived(userId, _asset, platformAmount);
    }

    function distribute(address _asset, bool productionMode) external onlyCore nonReentrant returns (uint256 totalAmount) {
        productionMode;
        uint256 users = totalSurrenderedUsers;
        uint256 pool = cashbackPoolBalanceByAsset[_asset];

        if (users == 0 || pool == 0) {
            return 0;
        }

        uint256 share = (pool * CASHBACK_SCALAR) / users;
        cashbackPerSurrenderedScaledByAsset[_asset] += share;
        cashbackPoolBalanceByAsset[_asset] = 0;
        totalAmount = pool;

        emit CashbackDistributed(totalAmount, users, users == 0 ? 0 : totalAmount / users);
    }

    function pendingCashback(
        uint256 userId,
        address _asset,
        bool productionMode
    ) external view returns (uint256 platformAmount, uint256 settlementAmount) {
        if (!surrendered[userId]) {
            return (0, 0);
        }

        if (productionMode) {
            uint256 accruedScaled = cashbackPerSurrenderedScaledByAsset[_asset] -
                cashbackClaimDebtByUserAsset[userId][_asset];
            uint256 settlementAccruedScaled = cashbackPerSurrenderedSettlementScaledByAsset[_asset] -
                cashbackSettlementClaimDebtByUserAsset[userId][_asset];
            return (accruedScaled / CASHBACK_SCALAR, settlementAccruedScaled / CASHBACK_SCALAR);
        }

        uint256 legacyAccruedScaled = cashbackPerSurrenderedScaled - cashbackClaimDebtByUser[userId];
        return (legacyAccruedScaled / CASHBACK_SCALAR, 0);
    }

    function claimCashback(
        address caller,
        uint256 userId
    ) external onlyCore nonReentrant returns (uint256 platformAmount, uint256 settlementAmount) {
        ISystemCashbackCore core = ISystemCashbackCore(coreContract);
        (, address account, , , , uint256 investedAmount, , , , , , , ) = core.usersById(userId);
        require(account != address(0), "User not found");
        require(account == caller, "Not your account");
        require(cashbackClaimed[userId] < investedAmount, "Max cashback reached");

        address _asset = core.defaultPaymentAsset();
        bool productionMode = core.productionMode();
        require(surrendered[userId], "User not surrendered");

        uint256 accumulated;
        if (productionMode) {
            accumulated =
                (cashbackPerSurrenderedScaledByAsset[_asset] - cashbackClaimDebtByUserAsset[userId][_asset]) / CASHBACK_SCALAR;
        } else {
            accumulated =
                (cashbackPerSurrenderedScaled - cashbackClaimDebtByUser[userId]) / CASHBACK_SCALAR;
        }
        platformAmount = accumulated;
        require(platformAmount > 0, "No cashback");

        uint256 claimed = cashbackClaimed[userId];
        uint256 remaining = investedAmount - claimed;
        require(remaining > 0, "Max cashback reached");
        if (platformAmount > remaining) {
            platformAmount = remaining;
        }
        settlementAmount = 0;
        cashbackClaimed[userId] += platformAmount;

        if (productionMode) {
            cashbackClaimDebtByUserAsset[userId][_asset] = cashbackPerSurrenderedScaledByAsset[_asset];
            cashbackSettlementClaimDebtByUserAsset[userId][_asset] =
                cashbackPerSurrenderedSettlementScaledByAsset[_asset];
        } else {
            cashbackClaimDebtByUser[userId] = cashbackPerSurrenderedScaled;
        }

        core.payoutUserIncome(userId, platformAmount, _asset);

        emit CashbackClaimed(userId, _asset, platformAmount, settlementAmount);
    }

    function _validateContract(address target) internal view {
        require(target != address(0), "Invalid contract");
        require(target.code.length > 0, "Target is not a contract");
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    address public paymentAsset;
    mapping(uint256 => uint256) public cashbackClaimed;
    uint256[35] private __gap;
}
