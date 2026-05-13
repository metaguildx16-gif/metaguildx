// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/MGXTypes.sol";
import "./libraries/UpgradeCycleLib.sol";
import "./utils/MetaGuildReentrancyGuardUpgradeable.sol";

interface IUpgradeManager {
    function trackIncome(uint256 userId, uint256 amount, uint256 packageLevel, uint256 packagePrice) external;
    function totalIncomeReceived(uint256 userId) external view returns (uint256);
    function resetCycle(uint256 userId) external;
    function hasCompletedCycle(uint256 userId) external view returns (bool);
    function markCycleComplete(uint256 userId) external;
}

interface IMGXStaking {
    function fundRewardPool(uint256 amount, address paymentAsset, uint256 settlementAmount) external;
    function stakeFor(
        address account,
        uint256 amount,
        uint256 settlementAmount,
        uint256 lockDuration,
        bool autoCompound,
        address paymentAsset
    ) external returns (uint256 autoCompoundedReward);
    function claimFor(
        address account
    ) external returns (uint256 reward, address paymentAsset, uint256 settlementAmount, uint256 autoCompoundedReward);
    function compoundFor(address account) external returns (uint256 reward, uint256 autoCompoundedReward);
    function withdrawFor(
        address account,
        uint256 amount
    ) external returns (uint256 amountAfterFee, address paymentAsset, uint256 settlementCredit, uint256 fee, uint256 autoCompoundedReward);
    function pendingStakingReward(address account) external view returns (uint256);
    function getStakePosition(
        address account
    )
        external
        view
        returns (uint256 amount, uint256 rewardDebt, uint256 accruedReward, uint256 lockStartedAt, uint256 lockDuration, bool autoCompound);
}

interface ICashbackPool {
    function notifyCashbackAccrued(uint256 platformAmount, address paymentAsset, uint256 settlementAmount) external;
    function surrenderForCashback(address caller, uint256 userId) external;
    function distribute(address paymentAsset, bool productionMode) external returns (uint256 totalAmount);
    function pendingCashback(
        uint256 userId,
        address paymentAsset,
        bool productionMode
    ) external view returns (uint256 platformAmount, uint256 settlementAmount);
    function claimCashback(
        address caller,
        uint256 userId
    ) external returns (uint256 platformAmount, uint256 settlementAmount);
}

interface IIncomeRouter {
    function distributeJoinIncome(uint256 fromUserId, uint256 sponsorId, uint256 businessAmount, address paymentAsset) external;
    function distributeUpgradeIncome(uint256 fromUserId, uint256 sponsorId, uint256 businessAmount, address paymentAsset) external;
    function distributeCrosslineIncome(uint256 fromUserId, uint256 toUserId, uint256 amount, address paymentAsset) external;
}

interface IBinaryTree {
    function assignRoot(uint256 userId) external;
    function placeNode(uint256 referrerId, uint256 userId) external;
}

error InvalidSigner();
error InvalidUnitPrice();
error NativeAssetMustBeZero();
error AlreadyRegistered();
error PlacementSignerNotSet();
error InvalidNonce();
error RootSponsorMustBeZero();
error InvalidRootPlacement();
error SponsorNotFound();
error NativePaymentDisabled();
error Unauthorized();
error UserNotFound();
error UpgradeOnlyToNextLevel();
error CashbackContractNotSet();
error AmountMustBePositive();
error InsufficientBalance();
error RootCannotReenter();
error ReentryNotAvailable();
error IncomeContractNotSet();
error StakingContractNotSet();
error InvalidStakingDuration();
error InvalidUser();
error CommunityAllocationExceeded();
error InvalidPlacementParent();
error PlacementParentNotFound();
error PlacementSlotOccupied();
error InvalidBoxPrice();
error NoTokensAvailableInCurrentBox();
error InvalidNativePayment();
error UnexpectedNativePayment();
error InvalidRecipient();
error InsufficientNativeLiquidity();
error NativePayoutFailed();
error InvalidPaymentAsset();
error InsufficientPlatformAssetBalance();
error InvalidContract();
error TargetNotContract();
error PaymentAssetDisabled();
error PaymentAssetNotConfigured();
error InvalidPlacementSignature();
error InvalidSignatureLength();
error InvalidSignatureV();
error InvalidSignature();

contract MetaGuildXSystem is Initializable, UUPSUpgradeable, OwnableUpgradeable, MetaGuildReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using MGXTypes for MGXTypes.UserProfile;

    uint256 public constant PLATFORM_SCALE = 10;
    uint256 public constant CASHBACK_JOIN_SHARE_BPS = 400;
    uint256 public constant CREATOR_SHARE_BPS = 1000;
    uint256 public constant STAKING_DAILY_RELEASE_BPS = 10;
    uint256 public constant STAKING_ACTION_FEE_BPS = 2_000;
    uint8 public constant MAX_LEVELS = 10;
    uint256 public constant MAX_SUBTREE_DEPTH = 20;
    uint256 public constant ONE_YEAR = 365 days;
    uint256 public constant TWO_YEARS = 730 days;
    uint256 public constant THREE_YEARS = 1095 days;

    uint256[] private packagePrices;
    uint256[] private boxPrices;
    uint256[] private boxReleaseBps;

    uint256 public nextUserId;
    uint256 public rootUserId;
    uint256 private cashbackPoolBalance;
    uint256 private stakingRewardPool;
    uint256 private totalStaked;
    uint256 private totalSurrenderedUsers;
    uint256 public totalCommunityTokenAllocation;
    uint256 public totalTokenDistributed;
    uint8 public currentBoxId;

    mapping(uint256 => MGXTypes.UserProfile) public usersById;
    mapping(address => uint256) public userIdByAddress;
    mapping(uint256 => MGXTypes.TreeNode) public treeNodes;
    mapping(uint256 => uint256[]) public directReferralsByUser;
    mapping(uint256 => uint256[]) public rebirthIdsByUser;
    mapping(uint256 => MGXTypes.IncomeLedger) public incomesByUser;
    mapping(uint256 => uint256) public internalWalletBalances;
    mapping(uint256 => uint256) public tokenAllocationsByUser;
    mapping(uint256 => uint8) public activeBoxByUser;
    mapping(uint8 => uint256) public distributedTokensByBox;
    mapping(uint256 => uint256) public xCountsByUser;
    mapping(uint256 => bool) private surrenderedUsers;
    mapping(address => MGXTypes.StakePosition) private stakePositions;

    address private coreContract;
    address private binaryTreeContract;
    address public incomeContract;
    address public stakingContract;
    address public cashbackContract;
    address public upgradeManagerContract;
    address public defaultPaymentAsset;
    bool public productionMode;
    uint256 private cashbackPerSurrenderedScaled;
    uint256 private cashbackDustScaled;

    mapping(address => bool) public enabledPaymentAssets;
    mapping(address => bool) public nativePaymentAssets;
    mapping(address => uint256) public paymentAssetUnitPrice;
    mapping(uint256 => uint256) private cashbackClaimDebtByUser;
    mapping(uint256 => uint256) public autoUpgradeEscrowByUser;
    mapping(uint256 => mapping(address => uint256)) public userAssetBalances;
    mapping(address => uint256) private cashbackPoolBalanceByAsset;
    mapping(address => uint256) private cashbackPerSurrenderedScaledByAsset;
    mapping(address => uint256) private cashbackDustScaledByAsset;
    mapping(uint256 => mapping(address => uint256)) private cashbackClaimDebtByUserAsset;
    mapping(uint256 => uint256) public twoXIncomeByUser;
    mapping(uint256 => uint256) public threeXIncomeByUser;
    mapping(uint256 => address) public userPrimaryAsset;
    mapping(uint256 => mapping(address => uint256)) public userPlatformBalancesByAsset;
    mapping(address => address) private stakingAssetByAccount;
    mapping(address => uint256) private stakeSettlementBalance;
    mapping(address => uint256) private stakingRewardPoolAssetReserve;
    mapping(address => uint256) private stakingRewardPoolPlatformReserve;
    address private placementSigner;
    address public creatorWallet;
    mapping(address => uint256) public nonces;

    uint8 private constant INCOME_TYPE_DIRECT = 0;
    uint8 private constant INCOME_TYPE_LEVEL = 1;
    uint8 private constant INCOME_TYPE_SPILLOVER = 2;
    uint8 private constant INCOME_TYPE_CROSSLINE = 3;
    uint8 private constant INCOME_TYPE_CASHBACK = 4;
    uint8 private constant INCOME_TYPE_STAKING = 5;
    uint8 private constant STAKING_ACTION_CLAIM = 1;
    uint8 private constant STAKING_ACTION_COMPOUND = 2;
    uint8 private constant STAKING_ACTION_WITHDRAW = 3;

    event UserRegistered(
        uint256 indexed userId,
        uint256 indexed sponsorId,
        address indexed account,
        uint8 packageLevel,
        uint256 amount,
        uint256 placedUnderId,
        bool placedLeft
    );
    event PackageUpgraded(uint256 indexed userId, uint8 fromLevel, uint8 toLevel, uint256 amount);
    event InternalWalletWithdrawn(uint256 indexed userId, uint256 amount);
    event RewardClaimed(address indexed account, uint256 amount);
    event RewardCompounded(address indexed account, uint256 amount);
    event StakeWithdrawn(address indexed account, uint256 amountAfterFee, uint256 feeAmount);
    event ReactivationCreated(uint256 indexed sourceUserId, uint256 indexed newUserId, uint256 sponsorId);
    event BinaryTreeContractSet(address indexed binaryTreeContractAddress);
    event IncomeContractSet(address indexed incomeContractAddress);
    event StakingContractSet(address indexed stakingContractAddress);
    event CashbackContractSet(address indexed cashbackContractAddress);
    event UpgradeManagerContractSet(address indexed upgradeManagerContractAddress);
    event ProductionModeSet(bool enabled, address indexed defaultPaymentAsset);
    event PaymentAssetConfigured(address indexed asset, bool enabled, bool isNative, uint256 unitPrice);
    event PaymentCollected(address indexed payer, address indexed asset, uint256 platformAmount, uint256 settlementAmount);
    event PaymentWithdrawn(address indexed recipient, address indexed asset, uint256 platformAmount, uint256 settlementAmount);
    event AutoUpgradeExecuted(uint256 indexed userId, uint8 fromLevel, uint8 toLevel, uint256 amount);
    event UpgradeTrackFailed(uint256 indexed userId, uint256 amount);
    event PlacementSignerSet(address indexed placementSignerAddress);
    event CreatorWalletSet(address indexed creatorWalletAddress);
    event RebirthIdCreated(uint256 indexed originalId, uint256 indexed newId, address wallet);
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier onlyIncomeRouter() {
        if (msg.sender != incomeContract) revert Unauthorized();
        _;
    }

    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
        __MetaGuildReentrancyGuard_init();

        packagePrices.push(10 * PLATFORM_SCALE);
        packagePrices.push(20 * PLATFORM_SCALE);
        packagePrices.push(40 * PLATFORM_SCALE);
        packagePrices.push(80 * PLATFORM_SCALE);
        packagePrices.push(160 * PLATFORM_SCALE);
        packagePrices.push(320 * PLATFORM_SCALE);
        packagePrices.push(640 * PLATFORM_SCALE);
        packagePrices.push(1280 * PLATFORM_SCALE);
        packagePrices.push(2560 * PLATFORM_SCALE);
        packagePrices.push(5120 * PLATFORM_SCALE);

        boxPrices.push(100);
        boxPrices.push(125);
        boxPrices.push(150);
        boxPrices.push(175);
        boxPrices.push(200);
        boxPrices.push(225);
        boxPrices.push(250);
        boxPrices.push(275);
        boxPrices.push(300);
        boxPrices.push(325);

        boxReleaseBps.push(2_000);
        boxReleaseBps.push(1_500);
        boxReleaseBps.push(1_200);
        boxReleaseBps.push(1_000);
        boxReleaseBps.push(800);
        boxReleaseBps.push(800);
        boxReleaseBps.push(700);
        boxReleaseBps.push(700);
        boxReleaseBps.push(700);
        boxReleaseBps.push(600);

        nextUserId = 1;
        totalCommunityTokenAllocation = 307_050_000 ether;
        currentBoxId = 1;
        creatorWallet = initialOwner;
    }

    function setIncomeContract(address incomeContractAddress) external onlyOwner {
        _validateContract(incomeContractAddress);
        incomeContract = incomeContractAddress;
        emit IncomeContractSet(incomeContractAddress);
    }

    function setBinaryTreeContract(address binaryTreeContractAddress_) external onlyOwner {
        _validateContract(binaryTreeContractAddress_);
        binaryTreeContract = binaryTreeContractAddress_;
        emit BinaryTreeContractSet(binaryTreeContractAddress_);
    }

    function setStakingContract(address stakingContractAddress) external onlyOwner {
        _validateContract(stakingContractAddress);
        stakingContract = stakingContractAddress;
        emit StakingContractSet(stakingContractAddress);
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

    function setPlacementSigner(address placementSignerAddress) external onlyOwner {
        if (placementSignerAddress == address(0)) revert InvalidSigner();
        placementSigner = placementSignerAddress;
        emit PlacementSignerSet(placementSignerAddress);
    }

    function setCreatorWallet(address creatorWalletAddress) external onlyOwner {
        if (creatorWalletAddress == address(0)) revert InvalidRecipient();
        creatorWallet = creatorWalletAddress;
        emit CreatorWalletSet(creatorWalletAddress);
    }

    function setProductionMode(bool enabled, address paymentAsset) external onlyOwner {
        if (enabled) {
            _validatePaymentAsset(paymentAsset);
        }

        productionMode = enabled;
        defaultPaymentAsset = paymentAsset;
        emit ProductionModeSet(enabled, paymentAsset);
    }

    function configurePaymentAsset(address asset, bool enabled, bool isNative, uint256 unitPrice) external onlyOwner {
        if (unitPrice == 0) revert InvalidUnitPrice();
        if (isNative) {
            if (asset != address(0)) revert NativeAssetMustBeZero();
        } else {
            _validateContract(asset);
        }

        enabledPaymentAssets[asset] = enabled;
        nativePaymentAssets[asset] = isNative;
        paymentAssetUnitPrice[asset] = unitPrice;

        emit PaymentAssetConfigured(asset, enabled, isNative, unitPrice);
    }

    function adminResetForTesting() external onlyOwner {
        nextUserId = 1;
        delete rootUserId;
        delete totalTokenDistributed;
        delete totalSurrenderedUsers;
    }

    function registerWithPlacement(
        uint256 sponsorId,
        uint256 placementParentId,
        bool isLeft,
        bytes calldata signature,
        uint256 nonce
    ) external payable nonReentrant returns (uint256 userId) {
        if (userIdByAddress[msg.sender] != 0) revert AlreadyRegistered();
        if (placementSigner == address(0)) revert PlacementSignerNotSet();
        if (nonce != nonces[msg.sender]) revert InvalidNonce();
        _verifyPlacementSignature(msg.sender, sponsorId, placementParentId, isLeft, nonce, signature);

        if (nextUserId == 1) {
            if (sponsorId != 0) revert RootSponsorMustBeZero();
            if (placementParentId != 0) revert InvalidRootPlacement();
        } else {
            if (usersById[sponsorId].id == 0) revert SponsorNotFound();
        }

        address settlementAsset = address(0);
        if (productionMode) {
            settlementAsset = defaultPaymentAsset;
            if (usdtTokenAddress != address(0) && settlementAsset != usdtTokenAddress) revert InvalidPaymentAsset();
            _collectPayment(settlementAsset, packagePrices[0]);
        } else {
            if (msg.value != 0) revert NativePaymentDisabled();
        }

        nonces[msg.sender] = nonce + 1;
        userId = _createUserWithPlacement(msg.sender, sponsorId, 1, false, settlementAsset, placementParentId, isLeft);
    }

    function upgradePackage(uint256 userId, uint8 newPackageLevel) external payable nonReentrant {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.account != msg.sender) revert Unauthorized();
        if (profile.id == 0) revert UserNotFound();
        if (newPackageLevel != profile.packageLevel + 1) revert UpgradeOnlyToNextLevel();

        uint256 upgradeAmount = UpgradeCycleLib.calcUpgradeCost(packagePrices[profile.packageLevel - 1]);
        address settlementAsset = address(0);
        if (productionMode) {
            settlementAsset = defaultPaymentAsset;
            if (usdtTokenAddress != address(0) && settlementAsset != usdtTokenAddress) revert InvalidPaymentAsset();
            _collectPayment(settlementAsset, upgradeAmount);
        } else {
            if (msg.value != 0) revert NativePaymentDisabled();
        }

        _applyPackageUpgrade(userId, newPackageLevel, settlementAsset, upgradeAmount);
    }

    function surrenderForCashback(uint256 userId) external nonReentrant {
        if (cashbackContract == address(0)) revert CashbackContractNotSet();
        ICashbackPool(cashbackContract).surrenderForCashback(msg.sender, userId);
    }

    function claimCashback(uint256 userId) external nonReentrant {
        if (cashbackContract == address(0)) revert CashbackContractNotSet();

        (uint256 platformAmount, uint256 settlementAmount) =
            ICashbackPool(cashbackContract).claimCashback(msg.sender, userId);

        if (productionMode && settlementAmount > 0) {
            _payoutSettlement(msg.sender, defaultPaymentAsset, settlementAmount);
        }
        incomesByUser[userId].cashbackIncome += platformAmount;
    }

    function finalizeCashbackSurrender(
        uint256 userId,
        address paymentAsset
    ) external returns (uint256 platformAmount, uint256 settlementAmount) {
        if (msg.sender != cashbackContract) revert Unauthorized();

        usersById[userId].surrendered = true;
        surrenderedUsers[userId] = true;
        totalSurrenderedUsers += 1;

        platformAmount = internalWalletBalances[userId];
        if (platformAmount == 0) {
            return (0, 0);
        }

        internalWalletBalances[userId] = 0;
        if (paymentAsset != address(0) && productionMode) {
            settlementAmount = _consumeUserAssetBalance(userId, paymentAsset, platformAmount);
        }
    }

    function withdrawInternalWallet(uint256 userId, uint256 amount) external nonReentrant {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.account != msg.sender && msg.sender != owner()) revert Unauthorized();
        if (amount == 0) revert AmountMustBePositive();
        if (internalWalletBalances[userId] < amount) revert InsufficientBalance();

        internalWalletBalances[userId] -= amount;
        incomesByUser[userId].totalWithdrawn += amount;
        if (productionMode) {
            uint256 settlementAmount = _consumeUserAssetBalance(userId, defaultPaymentAsset, amount);
            _payoutSettlement(profile.account, defaultPaymentAsset, settlementAmount);
        }

        emit InternalWalletWithdrawn(userId, amount);
    }

    function withdrawAsset(uint256 userId, address paymentAsset, uint256 platformAmount) external nonReentrant {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.account != msg.sender && msg.sender != owner()) revert Unauthorized();
        if (platformAmount == 0) revert AmountMustBePositive();
        if (internalWalletBalances[userId] < platformAmount) revert InsufficientBalance();

        internalWalletBalances[userId] -= platformAmount;
        uint256 settlementAmount = _consumeUserAssetBalance(userId, paymentAsset, platformAmount);
        incomesByUser[userId].totalWithdrawn += platformAmount;
        _payoutSettlement(profile.account, paymentAsset, settlementAmount);

        emit InternalWalletWithdrawn(userId, platformAmount);
    }

    function executeReentryWithPlacement(
        uint256 userId,
        address paymentAsset,
        uint256 placementParentId,
        bool isLeft,
        bytes calldata signature
    ) external nonReentrant returns (uint256 newUserId) {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.account != msg.sender) revert Unauthorized();
        if (profile.id == 0) revert UserNotFound();
        if (profile.sponsorId == 0) revert RootCannotReenter();
        if (xCountsByUser[userId] < (profile.rebirthCount + 1) * 5) revert ReentryNotAvailable();
        if (placementSigner == address(0)) revert PlacementSignerNotSet();

        _verifyReentryPlacementSignature(
            profile.account,
            userId,
            profile.sponsorId,
            placementParentId,
            isLeft,
            profile.rebirthCount,
            signature
        );
        if (placementParentId != profile.sponsorId) revert InvalidPlacementParent();
        if (isLeft != _findWeakLeg(profile.sponsorId)) revert InvalidPlacementParent();

        newUserId = _executeReentry(userId, paymentAsset, placementParentId, isLeft);
    }

    function fundStakingRewardPool(uint256 amount) external payable onlyOwner {
        if (amount == 0) revert AmountMustBePositive();
        IMGXStaking staking = _staking();

        address paymentAsset = address(0);
        uint256 settlementAmount = 0;
        if (productionMode) {
            paymentAsset = defaultPaymentAsset;
            settlementAmount = _collectPayment(paymentAsset, amount);
        } else {
            if (msg.value != 0) revert NativePaymentDisabled();
        }

        staking.fundRewardPool(amount, paymentAsset, settlementAmount);
    }

    function stake(uint256 amount, uint256 lockDuration, bool autoCompound) external payable nonReentrant {
        if (amount == 0) revert AmountMustBePositive();
        if (lockDuration != ONE_YEAR && lockDuration != TWO_YEARS && lockDuration != THREE_YEARS) revert InvalidStakingDuration();
        IMGXStaking staking = _staking();

        uint256 userId = _requireUserId(msg.sender);
        if (tokenAllocationsByUser[userId] < amount) revert InsufficientBalance();
        if (msg.value != 0) revert NativePaymentDisabled();

        tokenAllocationsByUser[userId] -= amount;

        uint256 autoCompoundedReward = staking.stakeFor(
            msg.sender,
            amount,
            0,
            lockDuration,
            autoCompound,
            address(0)
        );
        _recordStakingIncome(msg.sender, autoCompoundedReward);
    }

    function claimStakingReward() external nonReentrant {
        (uint256 reward, , , uint256 autoCompoundedReward) = _staking().claimFor(msg.sender);
        _applyStakingAction(STAKING_ACTION_CLAIM, reward, autoCompoundedReward, 0);
        emit RewardClaimed(msg.sender, reward);
    }

    function compoundStakingReward() external nonReentrant {
        (uint256 reward, uint256 autoCompoundedReward) = _staking().compoundFor(msg.sender);
        _applyStakingAction(STAKING_ACTION_COMPOUND, reward, autoCompoundedReward, 0);
        emit RewardCompounded(msg.sender, reward);
    }

    function withdrawStake(uint256 amount) external nonReentrant {
        (uint256 amountAfterFee, , , uint256 fee, uint256 autoCompoundedReward) = _staking().withdrawFor(msg.sender, amount);
        _applyStakingAction(STAKING_ACTION_WITHDRAW, 0, autoCompoundedReward, amountAfterFee);
        emit StakeWithdrawn(msg.sender, amountAfterFee, fee);
    }

    function pendingStakingReward(address account) external view returns (uint256) {
        return _staking().pendingStakingReward(account);
    }

    function getPackagePrices() external view returns (uint256[] memory) {
        return packagePrices;
    }

    function getBoxPrices() external view returns (uint256[] memory) {
        return boxPrices;
    }

    function getCurrentBoxStatus()
        external
        view
        returns (uint8 boxId, uint256 priceCents, uint256 distributed, uint256 cap, uint256 remaining)
    {
        boxId = currentBoxId;
        priceCents = boxPrices[boxId - 1];
        distributed = distributedTokensByBox[boxId];
        cap = (totalCommunityTokenAllocation * boxReleaseBps[boxId - 1]) / 10_000;
        remaining = cap > distributed ? cap - distributed : 0;
    }

    function incrementUserTeamBusiness(uint256 userId, uint256 amount) external {
        if (msg.sender != incomeContract) revert Unauthorized();
        if (userId == 0) revert InvalidUser();
        usersById[userId].totalTeamBusiness += amount;
    }

    function recordIncomeStats(
        uint256 userId,
        uint256 amount,
        address,
        uint8 incomeType
    ) external onlyIncomeRouter {
        if (amount == 0 || userId == 0) {
            return;
        }

        _recordIncomeStatsInternal(userId, amount, incomeType);
        _trackUpgradeManager(userId, amount);
    }

    function creditInnerWallet(uint256 userId, uint256 amount, address paymentAsset) external onlyIncomeRouter {
        if (amount == 0 || userId == 0) {
            return;
        }

        _creditInnerWalletInternal(userId, amount, paymentAsset);
    }

    function creditEscrow(uint256 userId, uint256 amount, address) external onlyIncomeRouter {
        if (amount == 0 || userId == 0) {
            return;
        }

        autoUpgradeEscrowByUser[userId] += amount;
        uint8 level = usersById[userId].packageLevel;
        if (level != 0) {
            uint256 packagePrice = packagePrices[level - 1];
            uint256 total = usersById[userId].totalEarnings == 0 ? 0 : usersById[userId].totalEarnings - 1;
            uint256 slot = UpgradeCycleLib.calcXSlot(total, packagePrice);
            if (slot == 1) {
                twoXIncomeByUser[userId] += amount;
            } else if (slot == 2) {
                threeXIncomeByUser[userId] += amount;
            }
        }

    }

    function getTotalIncome(uint256 userId) external view returns (uint256) {
        return usersById[userId].totalEarnings;
    }

    function getPackagePriceForUser(uint256 userId) external view returns (uint256) {
        uint8 level = usersById[userId].packageLevel;
        if (level == 0) {
            return 0;
        }
        return packagePrices[level - 1];
    }

    function routeCreatorFallbackIncome(
        uint256 userId,
        uint256 amount,
        string calldata,
        address paymentAsset,
        address recipient
    ) external {
        if (msg.sender != incomeContract) revert Unauthorized();
        if (userId != 0 && paymentAsset != address(0) && recipient != address(0)) {
            MGXTypes.UserProfile storage profile = usersById[userId];
            if (profile.account == recipient) {
                uint256 pending = internalWalletBalances[userId];
                if (pending != 0) {
                    internalWalletBalances[userId] = 0;
                    incomesByUser[userId].totalWithdrawn += pending;
                    uint256 settlementAmount = _consumeUserAssetBalance(userId, paymentAsset, pending);
                    _payoutSettlement(recipient, paymentAsset, settlementAmount);
                    emit InternalWalletWithdrawn(userId, pending);
                }
            }
        }
        _payoutCreatorFallbackIncome(amount, paymentAsset, recipient);
    }

    function executeUpgrade(uint256 userId, uint256 newLevel) external {
        bool routerTriggered = msg.sender == incomeContract;
        if (msg.sender != upgradeManagerContract && !routerTriggered) revert Unauthorized();

        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0) revert UserNotFound();
        if (profile.packageLevel >= MAX_LEVELS) revert UpgradeOnlyToNextLevel();

        uint8 nextLevel = uint8(newLevel);
        if (nextLevel != profile.packageLevel + 1) revert UpgradeOnlyToNextLevel();

        uint256 currentPackagePrice = packagePrices[profile.packageLevel - 1];
        uint256 upgradeAmount = UpgradeCycleLib.calcUpgradeCost(currentPackagePrice);
        address paymentAsset = productionMode ? defaultPaymentAsset : userPrimaryAsset[userId];
        if (productionMode && paymentAsset == address(0)) revert InvalidPaymentAsset();
        if (routerTriggered) {
            if (autoUpgradeEscrowByUser[userId] < upgradeAmount) revert InsufficientBalance();
            autoUpgradeEscrowByUser[userId] -= upgradeAmount;
        }
        twoXIncomeByUser[userId] = 0;
        threeXIncomeByUser[userId] = 0;

        uint8 fromLevel = profile.packageLevel;
        _applyPackageUpgrade(userId, nextLevel, paymentAsset, upgradeAmount);
        usersById[userId].totalEarnings = 0;
        try IUpgradeManager(upgradeManagerContract).resetCycle(userId) {} catch {}
        if (autoUpgradeEscrowByUser[userId] > 0 && paymentAsset != address(0)) {
            uint256 remaining = autoUpgradeEscrowByUser[userId];
            autoUpgradeEscrowByUser[userId] = 0;
            _creditInnerWalletInternal(userId, remaining, paymentAsset);
        }
        emit AutoUpgradeExecuted(userId, fromLevel, nextLevel, upgradeAmount);
    }

    function executeRebirth(uint256 userId) external onlyIncomeRouter returns (uint256 newUserId) {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0) revert UserNotFound();
        if (profile.packageLevel != 1) revert ReentryNotAvailable();
        if (profile.sponsorId == 0) revert RootCannotReenter();

        address paymentAsset = productionMode ? defaultPaymentAsset : userPrimaryAsset[userId];
        newUserId = _executeReentry(userId, paymentAsset, profile.sponsorId, _findWeakLeg(profile.sponsorId));
        emit RebirthIdCreated(userId, newUserId, profile.account);
    }

    function getDirectReferralIds(uint256 userId) external view returns (uint256[] memory) {
        return directReferralsByUser[userId];
    }

    function getRebirthIds(uint256 userId) external view returns (uint256[] memory) {
        return rebirthIdsByUser[userId];
    }

    function getUserSponsorId(uint256 userId) external view returns (uint256) {
        return usersById[userId].sponsorId;
    }

    function getPackagePriceByLevel(uint8 packageLevel) external view returns (uint256) {
        return packagePrices[packageLevel - 1];
    }

    function _applyPackageUpgrade(uint256 userId, uint8 newPackageLevel, address paymentAsset, uint256 upgradeAmount) internal {
        MGXTypes.UserProfile storage profile = usersById[userId];
        uint8 previousLevel = profile.packageLevel;
        uint256 sponsorId = profile.sponsorId;
        (uint256 tokenAmount, uint8 appliedBoxId) = _allocateTokensForCurrentBox(upgradeAmount);

        profile.packageLevel = newPackageLevel;
        profile.totalContribution += upgradeAmount;
        tokenAllocationsByUser[userId] += tokenAmount;
        activeBoxByUser[userId] = appliedBoxId;
        totalTokenDistributed += tokenAmount;
        if (totalTokenDistributed > totalCommunityTokenAllocation) revert CommunityAllocationExceeded();

        if (incomeContract == address(0)) revert IncomeContractNotSet();
        IIncomeRouter(incomeContract).distributeUpgradeIncome(userId, usersById[userId].sponsorId, upgradeAmount, paymentAsset);
        (, , uint256 cashbackPlatformShare, ) = UpgradeCycleLib.calcDistribution(upgradeAmount);
        uint256 cashbackSettlementShare = 0;
        if (paymentAsset != address(0)) {
            cashbackSettlementShare = _platformToSettlement(paymentAsset, cashbackPlatformShare);
        }
        if (totalSurrenderedUsers > 0) {
            if (cashbackContract == address(0)) revert CashbackContractNotSet();
            ICashbackPool(cashbackContract).notifyCashbackAccrued(upgradeAmount, paymentAsset, cashbackSettlementShare);
        } else {
            _payoutCreatorFallbackIncome(cashbackPlatformShare, paymentAsset, creatorWallet);
        }
        _payoutCreatorShare(upgradeAmount, paymentAsset);
        xCountsByUser[userId] += 1;
        usersById[userId].xCount = xCountsByUser[userId];
        if (paymentAsset != address(0)) {
            userPrimaryAsset[userId] = paymentAsset;
        }
        if (sponsorId != 0) {
            referralCountByPkg[sponsorId][newPackageLevel] += 1;
        }
        _trackUpgradeManager(userId, 0);

        emit PackageUpgraded(userId, previousLevel, newPackageLevel, upgradeAmount);
    }

    function _createUserWithPlacement(
        address account,
        uint256 sponsorId,
        uint8 packageLevel,
        bool isReactivation,
        address paymentAsset,
        uint256 placementParentId,
        bool placedLeft
    ) internal returns (uint256 userId) {
        userId = nextUserId++;
        uint256 packageAmount = packagePrices[packageLevel - 1];
        (uint256 placedUnderId, bool actualPlacedLeft) = _placeInSpecifiedSlot(userId, sponsorId, placementParentId, placedLeft);
        _finalizeUserCreation(
            userId,
            account,
            sponsorId,
            packageLevel,
            isReactivation,
            paymentAsset,
            packageAmount,
            placedUnderId,
            actualPlacedLeft
        );
    }

    function _finalizeUserCreation(
        uint256 userId,
        address account,
        uint256 sponsorId,
        uint8 packageLevel,
        bool isReactivation,
        address paymentAsset,
        uint256 packageAmount,
        uint256 placementParentId,
        bool placedLeft
    ) internal {

        usersById[userId] = MGXTypes.UserProfile({
            id: userId,
            account: account,
            sponsorId: sponsorId,
            packageLevel: packageLevel,
            totalContribution: packageAmount,
            totalEarnings: 0,
            directReferrals: 0,
            totalTeamBusiness: 0,
            rebirthCount: 0,
            xCount: 0,
            joinedAt: block.timestamp,
            surrendered: false
        });

        if (!isReactivation) {
            userIdByAddress[account] = userId;
        }
        if (paymentAsset != address(0)) {
            userPrimaryAsset[userId] = paymentAsset;
        }

        (uint256 tokenAmount, uint8 appliedBoxId) = _allocateTokensForCurrentBox(packageAmount);
        activeBoxByUser[userId] = appliedBoxId;
        tokenAllocationsByUser[userId] += tokenAmount;
        totalTokenDistributed += tokenAmount;
        if (totalTokenDistributed > totalCommunityTokenAllocation) revert CommunityAllocationExceeded();

        if (sponsorId != 0) {
            usersById[sponsorId].directReferrals += 1;
            usersById[sponsorId].totalTeamBusiness += packageAmount;
            directReferralsByUser[sponsorId].push(userId);
            referralCountByPkg[sponsorId][packageLevel] += 1;
        } else {
            rootUserId = userId;
        }

        if (incomeContract == address(0)) revert IncomeContractNotSet();
        IIncomeRouter(incomeContract).distributeJoinIncome(userId, sponsorId, packageAmount, paymentAsset);

        uint256 cashbackSettlementShare = 0;
        uint256 cashbackPlatformShare = (packageAmount * CASHBACK_JOIN_SHARE_BPS) / 10_000;
        if (paymentAsset != address(0)) {
            cashbackSettlementShare = (_platformToSettlement(paymentAsset, packageAmount) * CASHBACK_JOIN_SHARE_BPS) / 10_000;
        }
        if (totalSurrenderedUsers > 0) {
            if (cashbackContract == address(0)) revert CashbackContractNotSet();
            ICashbackPool(cashbackContract).notifyCashbackAccrued(packageAmount, paymentAsset, cashbackSettlementShare);
        } else {
            _payoutCreatorFallbackIncome(cashbackPlatformShare, paymentAsset, creatorWallet);
        }
        _payoutCreatorShare(packageAmount, paymentAsset);
        xCountsByUser[userId] += 1;
        usersById[userId].xCount = xCountsByUser[userId];
        _trackUpgradeManager(userId, 0);

        emit UserRegistered(userId, sponsorId, account, packageLevel, packageAmount, placementParentId, placedLeft);
    }

    function _placeInSpecifiedSlot(
        uint256 userId,
        uint256 sponsorId,
        uint256 placementParentId,
        bool placedLeft
    ) internal returns (uint256 placedUnderId, bool actualPlacedLeft) {
        if (rootUserId == 0) {
            if (sponsorId != 0) revert RootSponsorMustBeZero();
            if (placementParentId != 0) revert InvalidRootPlacement();
            treeNodes[userId] = MGXTypes.TreeNode({
                userId: userId,
                parentId: 0,
                leftChildId: 0,
                rightChildId: 0,
                depth: 0
            });
            _syncBinaryTree(userId, 0, true);
            return (0, false);
        }

        if (placementParentId == 0) revert InvalidPlacementParent();
        MGXTypes.TreeNode storage parentNode = treeNodes[placementParentId];
        if (parentNode.userId == 0) revert PlacementParentNotFound();

        if (placedLeft) {
            if (parentNode.leftChildId != 0) revert PlacementSlotOccupied();
            parentNode.leftChildId = userId;
        } else {
            if (parentNode.rightChildId != 0) revert PlacementSlotOccupied();
            parentNode.rightChildId = userId;
        }

        treeNodes[userId] = MGXTypes.TreeNode({
            userId: userId,
            parentId: placementParentId,
            leftChildId: 0,
            rightChildId: 0,
            depth: parentNode.depth + 1
        });
        _syncBinaryTree(userId, sponsorId, false);

        return (placementParentId, placedLeft);
    }

    function _syncBinaryTree(uint256 userId, uint256 referrerId, bool isRoot) internal {
        if (binaryTreeContract == address(0)) {
            return;
        }

        if (isRoot) {
            try IBinaryTree(binaryTreeContract).assignRoot(userId) {} catch {}
        } else {
            try IBinaryTree(binaryTreeContract).placeNode(referrerId, userId) {} catch {}
        }
    }

    function _trackUpgradeManager(uint256 userId, uint256 amount) internal {
        if (upgradeManagerContract == address(0)) {
            return;
        }

        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0 || profile.packageLevel == 0) {
            return;
        }

        try IUpgradeManager(upgradeManagerContract).trackIncome(
            userId,
            amount,
            profile.packageLevel,
            packagePrices[profile.packageLevel - 1]
        ) {} catch {
            emit UpgradeTrackFailed(userId, amount);
        }
    }

    function _recordIncomeStatsInternal(uint256 userId, uint256 amount, uint8 incomeType) internal {
        usersById[userId].totalEarnings += amount;

        if (incomeType == INCOME_TYPE_DIRECT) {
            incomesByUser[userId].directIncome += amount;
        } else if (incomeType == INCOME_TYPE_LEVEL) {
            incomesByUser[userId].levelIncome += amount;
        } else if (incomeType == INCOME_TYPE_SPILLOVER) {
            incomesByUser[userId].spilloverIncome += amount;
        } else if (incomeType == INCOME_TYPE_CROSSLINE) {
            incomesByUser[userId].crossLineIncome += amount;
        } else if (incomeType == INCOME_TYPE_STAKING) {
            incomesByUser[userId].stakingIncome += amount;
        } else if (incomeType == INCOME_TYPE_CASHBACK) {
            incomesByUser[userId].cashbackIncome += amount;
        }
    }

    function _creditInnerWalletInternal(uint256 userId, uint256 amount, address paymentAsset) internal {
        internalWalletBalances[userId] += amount;
        if (paymentAsset != address(0)) {
            _creditUserAssetBalance(userId, paymentAsset, amount, _platformToSettlement(paymentAsset, amount));
        }
    }

    function _staking() internal view returns (IMGXStaking staking) {
        if (stakingContract == address(0)) revert StakingContractNotSet();
        staking = IMGXStaking(stakingContract);
    }

    function _requireUserId(address account) internal view returns (uint256 userId) {
        userId = userIdByAddress[account];
        if (userId == 0) revert UserNotFound();
    }

    function _applyStakingAction(
        uint8 actionType,
        uint256 reward,
        uint256 autoCompoundedReward,
        uint256 principalCredit
    ) internal {
        uint256 incomeAmount = autoCompoundedReward;
        if (actionType != STAKING_ACTION_WITHDRAW) {
            incomeAmount += reward;
        }
        _recordStakingIncome(msg.sender, incomeAmount);
        if (actionType != STAKING_ACTION_COMPOUND) {
            uint256 userId = _requireUserId(msg.sender);
            tokenAllocationsByUser[userId] += actionType == STAKING_ACTION_CLAIM ? reward : principalCredit;
        }
    }

    function _recordStakingIncome(address account, uint256 reward) internal {
        if (reward == 0) {
            return;
        }

        uint256 userId = userIdByAddress[account];
        if (userId == 0) {
            return;
        }

        incomesByUser[userId].stakingIncome += reward;
    }

    function _allocateTokensForCurrentBox(uint256 packageUsdAmount) internal returns (uint256 allocatedTokens, uint8 appliedBoxId) {
        uint256 remainingUsdCents = (packageUsdAmount * 100) / PLATFORM_SCALE;
        uint8 workingBoxId = currentBoxId;
        appliedBoxId = workingBoxId;

        while (remainingUsdCents > 0 && workingBoxId <= boxPrices.length) {
            uint256 priceCents = boxPrices[workingBoxId - 1];
            uint256 releaseCap = (totalCommunityTokenAllocation * boxReleaseBps[workingBoxId - 1]) / 10_000;
            uint256 alreadyDistributed = distributedTokensByBox[workingBoxId];
            uint256 remainingCap = releaseCap > alreadyDistributed ? releaseCap - alreadyDistributed : 0;

            if (remainingCap == 0) {
                if (workingBoxId < boxPrices.length) {
                    workingBoxId += 1;
                    currentBoxId = workingBoxId;
                    continue;
                }
                break;
            }

            uint256 requestedTokens = (remainingUsdCents * 1 ether) / priceCents;
            uint256 boxTokens = requestedTokens > remainingCap ? remainingCap : requestedTokens;
            uint256 consumedUsdCents = (boxTokens * priceCents) / 1 ether;

            allocatedTokens += boxTokens;
            distributedTokensByBox[workingBoxId] += boxTokens;

            if (consumedUsdCents >= remainingUsdCents) {
                remainingUsdCents = 0;
            } else {
                remainingUsdCents -= consumedUsdCents;
            }

            if (distributedTokensByBox[workingBoxId] >= releaseCap && workingBoxId < boxPrices.length) {
                workingBoxId += 1;
                currentBoxId = workingBoxId;
            }
        }

        if (allocatedTokens == 0) revert NoTokensAvailableInCurrentBox();
    }

    function _collectPayment(address paymentAsset, uint256 platformAmount) internal returns (uint256 settlementAmount) {
        _validatePaymentAsset(paymentAsset);

        settlementAmount = platformAmount * paymentAssetUnitPrice[paymentAsset];
        if (nativePaymentAssets[paymentAsset]) {
            if (msg.value != settlementAmount) revert InvalidNativePayment();
        } else {
            if (msg.value != 0) revert UnexpectedNativePayment();
            IERC20(paymentAsset).safeTransferFrom(msg.sender, address(this), settlementAmount);
        }

        emit PaymentCollected(msg.sender, paymentAsset, platformAmount, settlementAmount);
    }

    function _payoutSettlement(address recipient, address paymentAsset, uint256 settlementAmount) internal {
        _validatePaymentAsset(paymentAsset);
        if (recipient == address(0)) revert InvalidRecipient();

        if (nativePaymentAssets[paymentAsset]) {
            if (address(this).balance < settlementAmount) revert InsufficientNativeLiquidity();
            (bool success, ) = payable(recipient).call{value: settlementAmount}("");
            if (!success) revert NativePayoutFailed();
        } else {
            IERC20(paymentAsset).safeTransfer(recipient, settlementAmount);
        }

        emit PaymentWithdrawn(recipient, paymentAsset, 0, settlementAmount);
    }

    function _platformToSettlement(address paymentAsset, uint256 platformAmount) internal view returns (uint256) {
        _validatePaymentAsset(paymentAsset);
        return platformAmount * paymentAssetUnitPrice[paymentAsset];
    }

    function _creditUserAssetBalance(uint256 userId, address paymentAsset, uint256 platformAmount, uint256 settlementAmount) internal {
        userPlatformBalancesByAsset[userId][paymentAsset] += platformAmount;
        userAssetBalances[userId][paymentAsset] += settlementAmount;
        if (userPrimaryAsset[userId] == address(0)) {
            userPrimaryAsset[userId] = paymentAsset;
        }
    }

    function _payoutCreatorShare(uint256 platformAmount, address paymentAsset) internal {
        _payoutCreatorAmount(platformAmount, paymentAsset, address(0), CREATOR_SHARE_BPS);
    }

    function _payoutCreatorFallbackIncome(uint256 platformAmount, address paymentAsset, address recipient) internal {
        _payoutCreatorAmount(platformAmount, paymentAsset, recipient, 10_000);
    }

    function _payoutCreatorAmount(
        uint256 platformAmount,
        address paymentAsset,
        address recipient,
        uint256 bps
    ) internal {
        if (paymentAsset == address(0) || platformAmount == 0) {
            return;
        }

        address payoutRecipient = recipient == address(0) ? (creatorWallet == address(0) ? owner() : creatorWallet) : recipient;
        uint256 settlementAmount = (_platformToSettlement(paymentAsset, platformAmount) * bps) / 10_000;
        if (settlementAmount == 0) {
            return;
        }

        _payoutSettlement(payoutRecipient, paymentAsset, settlementAmount);
    }

    function _getSubtreeCount(uint256 nodeId, uint256 depth) internal view returns (uint256) {
        if (nodeId == 0 || depth >= MAX_SUBTREE_DEPTH) {
            return 0;
        }

        MGXTypes.TreeNode storage node = treeNodes[nodeId];
        return 1 + _getSubtreeCount(node.leftChildId, depth + 1) + _getSubtreeCount(node.rightChildId, depth + 1);
    }

    function _findWeakLeg(uint256 uplineId) internal view returns (bool isLeft) {
        MGXTypes.TreeNode storage node = treeNodes[uplineId];
        uint256 leftCount = _getSubtreeCount(node.leftChildId, 0);
        uint256 rightCount = _getSubtreeCount(node.rightChildId, 0);
        return leftCount <= rightCount;
    }

    function _executeReentry(
        uint256 userId,
        address paymentAsset,
        uint256 placementParentId,
        bool isLeft
    ) internal returns (uint256 newUserId) {
        MGXTypes.UserProfile storage profile = usersById[userId];
        uint256 reentryAmount = packagePrices[0];
        _consumeReentryFunding(userId, paymentAsset, reentryAmount);

        newUserId = _createUserWithPlacement(profile.account, profile.sponsorId, 1, true, paymentAsset, placementParentId, isLeft);
        usersById[userId].rebirthCount += 1;
        rebirthIdsByUser[userId].push(newUserId);
        if (incomeContract == address(0)) revert IncomeContractNotSet();
        IIncomeRouter(incomeContract).distributeCrosslineIncome(userId, profile.sponsorId, reentryAmount, paymentAsset);

        emit ReactivationCreated(userId, newUserId, profile.sponsorId);
    }

    function _consumeReentryFunding(uint256 userId, address paymentAsset, uint256 platformAmount) internal {
        if (internalWalletBalances[userId] < platformAmount) revert InsufficientBalance();
        internalWalletBalances[userId] -= platformAmount;

        if (productionMode) {
            if (paymentAsset == address(0)) revert InvalidPaymentAsset();
            _consumeUserAssetBalance(userId, paymentAsset, platformAmount);
        }
    }

    function _consumeUserAssetBalance(uint256 userId, address paymentAsset, uint256 platformAmount) internal returns (uint256 settlementAmount) {
        if (userPlatformBalancesByAsset[userId][paymentAsset] < platformAmount) revert InsufficientPlatformAssetBalance();

        uint256 platformBalance = userPlatformBalancesByAsset[userId][paymentAsset];
        uint256 assetBalance = userAssetBalances[userId][paymentAsset];
        settlementAmount = platformAmount == platformBalance ? assetBalance : (assetBalance * platformAmount) / platformBalance;

        userPlatformBalancesByAsset[userId][paymentAsset] -= platformAmount;
        userAssetBalances[userId][paymentAsset] -= settlementAmount;
    }

    function _validateContract(address target) internal view {
        if (target == address(0)) revert InvalidContract();
        if (target.code.length == 0) revert TargetNotContract();
    }

    function _validatePaymentAsset(address paymentAsset) internal view {
        if (!enabledPaymentAssets[paymentAsset]) revert PaymentAssetDisabled();
        if (!nativePaymentAssets[paymentAsset]) {
            _validateContract(paymentAsset);
        }
        if (paymentAssetUnitPrice[paymentAsset] == 0) revert PaymentAssetNotConfigured();
    }

    function _verifyPlacementSignature(
        address account,
        uint256 sponsorId,
        uint256 placementParentId,
        bool isLeft,
        uint256 nonce,
        bytes calldata signature
    ) internal view {
        bytes32 structHash = keccak256(
            abi.encodePacked(block.chainid, address(this), account, sponsorId, placementParentId, isLeft, nonce)
        );
        _verifyPlacementDigest(structHash, signature);
    }

    function _verifyReentryPlacementSignature(
        address account,
        uint256 userId,
        uint256 sponsorId,
        uint256 placementParentId,
        bool isLeft,
        uint256 nonce,
        bytes calldata signature
    ) internal view {
        bytes32 structHash = keccak256(
            abi.encodePacked(block.chainid, address(this), account, userId, sponsorId, placementParentId, isLeft, nonce)
        );
        _verifyPlacementDigest(structHash, signature);
    }

    function _verifyPlacementDigest(bytes32 structHash, bytes calldata signature) internal view {
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", structHash));
        address recoveredSigner = _recoverSigner(digest, signature);
        if (recoveredSigner != placementSigner) revert InvalidPlacementSignature();
    }

    function _recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) revert InvalidSignatureLength();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        if (v < 27) {
            v += 27;
        }
        if (v != 27 && v != 28) revert InvalidSignatureV();

        address recoveredSigner = ecrecover(digest, v, r, s);
        if (recoveredSigner == address(0)) revert InvalidSignature();
        return recoveredSigner;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    address private mgxTokenAddress;

    function setMgxTokenAddress(address mgxTokenAddress_) external onlyOwner {
        mgxTokenAddress = mgxTokenAddress_;
    }

    address private usdtTokenAddress;

    function setUsdtTokenAddress(address usdtTokenAddress_) external onlyOwner {
        usdtTokenAddress = usdtTokenAddress_;
    }

    mapping(uint256 => mapping(uint256 => uint256)) public referralCountByPkg;

    uint256[16] private __gap;
}
