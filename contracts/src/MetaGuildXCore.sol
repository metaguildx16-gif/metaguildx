// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IMetaGuildXTokenEngine.sol";
import "./libs/MetaGuildXPaymentLib.sol";
import "./libs/MetaGuildXPlacementLib.sol";
import "./libraries/MGXTypes.sol";
import "./libraries/UpgradeCycleLib.sol";
import "./utils/MetaGuildReentrancyGuardUpgradeable.sol";

interface IMetaGuildXBinaryTree {
    function assignRoot(uint256 userId) external;
    function placeNodeExact(uint256 parentId, uint256 userId, bool isLeft) external;
    function placeUserForced(uint256 userId, uint256 parentId, bool forceLeft) external;
    function placeNode(uint256 referrerId, uint256 userId) external;
    function handleSurrender(uint256 userId) external;
    function findNextAvailableSlot(uint256 startNodeId) external view returns (uint256 parentId, bool isLeft);
    function findNextSlotUnderSponsor(uint256 sponsorId) external view returns (uint256 parentId, bool isLeft);
    function getParent(uint256 userId) external view returns (uint256);
    function getChildren(uint256 userId) external view returns (uint256 left, uint256 right);
    function getLevelParent(uint256 userId) external view returns (uint256);
    function getLevelChildren(uint256 userId) external view returns (uint256 left, uint256 right);
    function isLevelEligible(uint256 userId) external view returns (bool);
    function refreshLevelEligibility(uint256 userId, uint256 referralCount, uint256 sponsorId) external;
    function adminResetLevelTree(uint256 maxUserId) external;
    function adminInsertLevelUser(uint256 userId, uint256 sponsorId) external;
}

interface IMetaGuildXRouter {
    function distributeJoinIncome(
        uint256 fromUserId,
        uint256 sponsorId,
        uint256 placedUnderId,
        uint256 businessAmount,
        address paymentAsset,
        uint256 originalUserId
    ) external;
    function distributeUpgradeIncome(
        uint256 fromUserId,
        uint256 sponsorId,
        uint256 businessAmount,
        address paymentAsset
    ) external;
    function distributeCrosslineIncome(uint256 fromUserId, uint256 toUserId, uint256 amount, address paymentAsset) external;
}

interface IMetaGuildXIncome {
    function getEscrow(uint256 userId) external view returns (uint256);
    function getTotalEscrow(uint256 userId) external view returns (uint256);
    function releaseEscrow(uint256 userId, uint256 amount) external;
    function releaseAllEscrow(uint256 userId, uint256 amount) external;
    function releaseStrandedEscrow(uint256 userId, address paymentAsset) external;
    function resetIncome(uint256 userId) external;
}

interface IMetaGuildXCashbackPool {
    function notifyCashbackAccrued(uint256 platformAmount, address paymentAsset, uint256 settlementAmount) external;
    function totalSurrenderedUsers() external view returns (uint256);
}

interface ICashbackPool {
    function surrenderForCashback(address user, uint256 userId) external;
    function claimCashback(address user, uint256 userId) external;
}

interface IMGXStaking {
    function stakeFor(
        address user,
        uint256 amount,
        uint256 settlementAmount,
        uint256 lockDuration,
        bool autoCompound,
        address paymentAsset
    ) external;
    function claimFor(address user) external;
    function compoundFor(address user) external;
    function withdrawFor(address user, uint256 amount) external;
}

interface IMetaGuildXUpgradeEngine {
    function getRebirthIds(uint256 userId) external view returns (uint256[] memory);
}

error NotFailedDistribution(uint256 userId);
error UserNotFound(uint256 userId);
error AlreadyRegistered();
error InvalidNonce();
error RootSponsorMustBeZero();
error SponsorNotFound(uint256 sponsorId);
error NothingToSweep();
error NoEscrowToRelease();
error OnlyIncomeEngine();
error OnlyUpgradeEngine();
error OnlyEngine();
error OnlyRouter();
error OnlyIncomeOrUpgradeEngine();
error InvalidSigner();
error InvalidRecipient();
error BinaryTreeNotSet();
error InvalidContract();
error PlacementSignerNotSet();
error PaymentAssetDisabled();
error PaymentAssetNotConfigured();
error InvalidSignatureLength();
error InvalidSignatureV();
error InvalidSignature();
error NativePaymentDisabled();
error UnexpectedNativePayment();
error InvalidNativePayment();
error NativePayoutFailed();
error Unauthorized();
error NotOwnerOfUser();
error NotYetAvailable();
error WindowExpired();
error NotUser();
error OnlyCashbackPool();
error UserNotRegistered();
error UserNotActive();
error InvalidUserId();
error InvalidParentId();
error TreeNotSet();
error InvalidAddress();
error ZeroAmount();
error InsufficientBalance();
error LengthMismatch();
error NoTree();
error InsufficientCoreBalance();
error UpgradeOnlyToNextLevel();
error RebirthCannotUpgrade();
error NoTokensAvailable();
error TokenEngineNotSet();

contract MetaGuildXCore is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, MetaGuildReentrancyGuardUpgradeable {
    uint256 public constant PLATFORM_SCALE = 10;
    uint256 public constant CASHBACK_JOIN_SHARE_BPS = 400;
    uint256 public constant CREATOR_SHARE_BPS = 1000;
    uint256 public constant MAX_SUBTREE_DEPTH = 20;

    uint256[] private packagePricesArray;
    uint256[] private boxPrices;
    uint256[] private boxReleaseBps;

    uint256 public nextUserId;
    uint256 public rootUserId;
    // DEPRECATED STORAGE (DO NOT USE)
    // kept only for upgrade-safe storage compatibility
    // active surrender counting moved to CashbackPool
    uint256 public totalSurrenderedUsers;
    uint256 public totalCommunityTokenAllocation;
    uint256 public totalTokenDistributed;
    uint8 public currentBoxId;

    mapping(uint256 => MGXTypes.UserProfile) public usersById;
    mapping(address => uint256) public userIdByAddress;
    // DEPRECATED STORAGE (DO NOT USE)
    // kept only for upgrade-safe storage compatibility
    // active tree logic moved to BinaryTree
    mapping(uint256 => MGXTypes.TreeNode) public treeNodes;
    mapping(uint256 => uint256[]) public directReferralsByUser;
    mapping(uint256 => uint256) public tokenAllocationsByUser;
    mapping(uint256 => uint8) public activeBoxByUser;
    mapping(uint8 => uint256) public distributedTokensByBox;
    mapping(uint256 => mapping(uint256 => uint256)) public referralCountByPkg;
    mapping(uint256 => address) public userPrimaryAsset;
    mapping(uint256 => bool) public manuallyUpgraded;

    address public placementSigner;
    address public binaryTreeContract;
    address public mgxTokenAddress;
    address public usdtAddress;
    address public defaultPaymentAsset;
    address public incomeRouterContract;
    address public incomeEngineContract;
    address public upgradeEngineContract;
    address public creatorFeeWallet;
    address public cashbackPoolContract;

    bool public productionMode;

    mapping(address => bool) public enabledPaymentAssets;
    mapping(address => bool) public nativePaymentAssets;
    mapping(address => uint256) public paymentAssetUnitPrice;
    mapping(address => uint256) public nonces;

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
    event PackageLevelUpdated(uint256 indexed userId, uint256 newLevel);
    event RebirthUserCreated(uint256 indexed originalUserId, uint256 indexed newUserId, address wallet);
    event PaymentCollected(address indexed payer, address indexed asset, uint256 platformAmount, uint256 settlementAmount);
    event PaymentWithdrawn(address indexed recipient, address indexed asset, uint256 platformAmount, uint256 settlementAmount);
    event SystemReset(uint256 timestamp);
    event DistributionFailed(uint256 indexed userId, uint256 timestamp);
    event DistributionFailedReason(uint256 indexed userId, bytes reason);
    event DistributionRetried(uint256 indexed userId, bool success);

    modifier onlyIncomeEngine() {
        if (msg.sender != incomeEngineContract) revert OnlyIncomeEngine();
        _;
    }

    modifier onlyUpgradeEngine() {
        if (msg.sender != upgradeEngineContract) revert OnlyUpgradeEngine();
        _;
    }

    modifier onlyIncomeOrUpgradeEngine() {
        if (
            msg.sender != incomeEngineContract &&
            msg.sender != upgradeEngineContract &&
            msg.sender != cashbackPoolContract
        ) revert OnlyIncomeOrUpgradeEngine();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __MetaGuildReentrancyGuard_init();

        packagePricesArray.push(10 * PLATFORM_SCALE);
        packagePricesArray.push(20 * PLATFORM_SCALE);
        packagePricesArray.push(40 * PLATFORM_SCALE);
        packagePricesArray.push(80 * PLATFORM_SCALE);
        packagePricesArray.push(160 * PLATFORM_SCALE);
        packagePricesArray.push(320 * PLATFORM_SCALE);
        packagePricesArray.push(640 * PLATFORM_SCALE);
        packagePricesArray.push(1280 * PLATFORM_SCALE);
        packagePricesArray.push(2560 * PLATFORM_SCALE);
        packagePricesArray.push(5120 * PLATFORM_SCALE);

        nextUserId = 1;
        creatorFeeWallet = initialOwner;
    }

    function registerWithPlacement(
        uint256 sponsorId,
        uint256 placementParentId,
        bool isLeft,
        bytes calldata signature,
        uint256 nonce
    ) external payable nonReentrant whenNotPaused returns (uint256 userId) {
        if (userIdByAddress[msg.sender] != 0) revert AlreadyRegistered();
        if (placementSigner == address(0)) revert PlacementSignerNotSet();
        if (nonce != nonces[msg.sender]) revert InvalidNonce();
        _verifyPlacementSignature(msg.sender, sponsorId, nonce, signature);

        if (nextUserId == 1) {
            if (sponsorId != 0) revert RootSponsorMustBeZero();
        } else {
            if (usersById[sponsorId].id == 0) revert SponsorNotFound(sponsorId);
        }
        address paymentAsset = defaultPaymentAsset;
        if (productionMode) {
            _collectPayment(paymentAsset, packagePricesArray[0]);
        } else {
            if (msg.value != 0) revert NativePaymentDisabled();
            paymentAsset = address(0);
        }

        nonces[msg.sender] = nonce + 1;
        userId = _createUserWithPlacement(msg.sender, sponsorId, 1, false, paymentAsset, placementParentId, isLeft);
    }

    function upgradePackage(uint256 userId, uint8 newPackageLevel) external payable nonReentrant whenNotPaused {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.account != msg.sender) revert Unauthorized();
        if (profile.id == 0) revert UserNotFound(userId);
        if (newPackageLevel != profile.packageLevel + 1) revert UpgradeOnlyToNextLevel();
        if (isRebirthUser(userId)) revert RebirthCannotUpgrade();

        uint256 upgradeAmount = UpgradeCycleLib.calcUpgradeCost(packagePricesArray[profile.packageLevel - 1]);
        address paymentAsset = defaultPaymentAsset;
        uint256 escrowBalance = IMetaGuildXIncome(incomeEngineContract).getTotalEscrow(userId);
        uint256 walletCharge = upgradeAmount > escrowBalance ? upgradeAmount - escrowBalance : 0;
        if (productionMode) {
            if (walletCharge > 0) {
                _collectPayment(paymentAsset, walletCharge);
            }
        } else {
            if (msg.value != 0) revert NativePaymentDisabled();
            paymentAsset = address(0);
        }

        if (escrowBalance > 0) {
            IMetaGuildXIncome(incomeEngineContract).releaseAllEscrow(userId, escrowBalance);
        }

        IMetaGuildXIncome(incomeEngineContract).releaseStrandedEscrow(userId, paymentAsset);
        // resetIncomeByCore removed — manual upgrade must not reset xSlot cycle
        // Auto upgrade path (checkAndTriggerUpgrade) already does not reset
        manuallyUpgraded[userId] = true;
        _applyPackageUpgrade(userId, newPackageLevel, paymentAsset, upgradeAmount);
    }

    function processUpgradeFromEngine(
        uint256 userId,
        uint8 newPackageLevel,
        address paymentAsset,
        uint256 upgradeAmount
    ) external onlyUpgradeEngine {
        _applyPackageUpgrade(userId, newPackageLevel, paymentAsset, upgradeAmount);
    }

    function setUserPackageLevel(uint256 userId, uint256 newLevel) external onlyUpgradeEngine {
        usersById[userId].packageLevel = uint8(newLevel);
        emit PackageLevelUpdated(userId, newLevel);
    }

    function payoutUserIncome(uint256 userId, uint256 amount, address paymentAsset) external onlyIncomeOrUpgradeEngine {
        if (amount == 0) {
            return;
        }
        address wallet = usersById[userId].account;
        if (wallet == address(0)) revert UserNotFound(userId);
        _payoutSettlement(wallet, paymentAsset, _platformToSettlement(paymentAsset, amount));
    }

    function routeCreatorFallbackIncome(
        uint256,
        uint256 amount,
        string calldata,
        address paymentAsset,
        address recipient
    ) external {
        if (msg.sender != incomeRouterContract) revert OnlyRouter();
        _payoutCreatorAmount(amount, paymentAsset, recipient, 10_000);
    }

    function incrementUserTeamBusiness(uint256 userId, uint256 amount) external {
        if (msg.sender != incomeRouterContract) revert OnlyRouter();
        if (userId == 0 || amount == 0) {
            return;
        }

        usersById[userId].totalTeamBusiness += amount;
    }

    function getPackagePrices() external view returns (uint256[] memory) {
        return packagePricesArray;
    }

    function getDirectReferralIds(uint256 userId) external view returns (uint256[] memory) {
        return directReferralsByUser[userId];
    }

    function getPackagePriceForUser(uint256 userId) external view returns (uint256) {
        uint8 packageLevel = usersById[userId].packageLevel;
        if (packageLevel == 0 || packageLevel > packagePricesArray.length) {
            return 0;
        }
        return packagePricesArray[packageLevel - 1];
    }

    function getUserPackageLevel(uint256 userId) external view returns (uint256) {
        return usersById[userId].packageLevel;
    }

    function getUserOriginalPackageLevel(uint256 userId) external view returns (uint8) {
        return usersById[userId].originalPackageLevel;
    }

    function isUserActive(uint256 userId) external view returns (bool) {
        return activeUsers[userId];
    }

    function getPackagePriceByLevel(uint256 level) external view returns (uint256) {
        if (level == 0 || level > packagePricesArray.length) {
            return 0;
        }
        return packagePricesArray[level - 1];
    }

    function getUserWallet(uint256 userId) external view returns (address) {
        return usersById[userId].account;
    }

    function getUserSponsorId(uint256 userId) external view returns (uint256) {
        return usersById[userId].sponsorId;
    }

    /**
     * @notice Check if candidateId is in rootId's sponsor genealogy
     * Walks UP candidateId's sponsor chain to see if rootId is an ancestor
     * Max 20 hops to prevent infinite loop
     */
    function isInSponsorGenealogy(uint256 candidateId, uint256 rootId) external view returns (bool) {
        if (candidateId == rootId) return true;
        if (rootId == 0 || candidateId == 0) return false;

        uint256 current = candidateId;
        uint256 maxHops = 20;

        for (uint256 i = 0; i < maxHops; i++) {
            uint256 sponsor = usersById[current].sponsorId;
            if (sponsor == 0) return false;
            if (sponsor == rootId) return true;
            current = sponsor;
        }

        return false;
    }

    function getParent(uint256 userId) external view returns (uint256) {
        if (binaryTreeContract == address(0)) {
            return 0;
        }

        return IMetaGuildXBinaryTree(binaryTreeContract).getParent(userId);
    }

    function getBinaryParent(uint256 userId) external view returns (uint256) {
        if (binaryTreeContract == address(0)) {
            return 0;
        }

        return IMetaGuildXBinaryTree(binaryTreeContract).getParent(userId);
    }

    function getLevelParent(uint256 userId) external view returns (uint256) {
        if (binaryTreeContract == address(0)) {
            return 0;
        }

        return IMetaGuildXBinaryTree(binaryTreeContract).getLevelParent(userId);
    }

    function isLevelEligibleUser(uint256 userId) external view returns (bool) {
        if (binaryTreeContract == address(0)) {
            return false;
        }

        return IMetaGuildXBinaryTree(binaryTreeContract).isLevelEligible(userId);
    }

    function isRebirthUser(uint256 userId) public view returns (bool) {
        return usersById[userId].rebirthCount > 0;
    }

    function createRebirthUser(uint256 originalUserId) external onlyUpgradeEngine returns (uint256) {
        MGXTypes.UserProfile storage original = usersById[originalUserId];
        if (original.id == 0) revert UserNotFound(originalUserId);

        address wallet = original.account;
        uint256 baseSponsorId = original.sponsorId;

        uint256 placementSponsorId;
        if (baseSponsorId == 0) {
            // Root user rebirths place within the user's own weakest leg.
            placementSponsorId = originalUserId;
        } else {
            uint256[] memory sponsorRebirths =
                IMetaGuildXUpgradeEngine(upgradeEngineContract).getRebirthIds(baseSponsorId);

            if (sponsorRebirths.length > 0) {
                // Case 2: Sponsor has rebirth -> place under latest rebirth (unchanged)
                placementSponsorId = sponsorRebirths[sponsorRebirths.length - 1];
            } else {
                // Case 3: No rebirth -> place under sponsor on OPPOSITE side
                placementSponsorId = baseSponsorId;
            }
        }

        bool weakLeft;
        if (baseSponsorId == 0) {
            // Root user: use weakest leg (unchanged)
            weakLeft = _findWeakLeg(placementSponsorId);
        } else {
            uint256[] memory sponsorRebirthsCheck =
                IMetaGuildXUpgradeEngine(upgradeEngineContract).getRebirthIds(baseSponsorId);

            if (sponsorRebirthsCheck.length > 0) {
                // Case 2: sponsor has rebirth -> use weakest leg under that rebirth
                weakLeft = _findWeakLeg(placementSponsorId);
            } else {
                // Case 3: no rebirth -> find which side originalUser is on,
                // place rebirth on OPPOSITE side
                (uint256 leftChildId, uint256 rightChildId) =
                    IMetaGuildXBinaryTree(binaryTreeContract).getChildren(baseSponsorId);

                bool originalIsOnLeft = (leftChildId == originalUserId);
                bool originalIsOnRight = (rightChildId == originalUserId);

                if (originalIsOnLeft) {
                    // Original is Left -> place rebirth on Right
                    weakLeft = false;
                } else if (originalIsOnRight) {
                    // Original is Right -> place rebirth on Left
                    weakLeft = true;
                } else {
                    // Original not direct child of sponsor -> fallback weakest leg
                    weakLeft = _findWeakLeg(placementSponsorId);
                }
            }
        }
        address paymentAsset = userPrimaryAsset[originalUserId];
        if (paymentAsset == address(0)) {
            paymentAsset = defaultPaymentAsset;
        }

        uint256 weakChild;
        if (binaryTreeContract != address(0)) {
            (uint256 leftChildId, uint256 rightChildId) = IMetaGuildXBinaryTree(binaryTreeContract).getChildren(placementSponsorId);
            weakChild = weakLeft ? leftChildId : rightChildId;
        }

        uint256 newId = nextUserId++;
        uint256 packageAmount = packagePricesArray[0];
        uint256 placedUnderId;
        bool actualPlacedLeft;

        if (weakChild == 0) {
            // Weak-leg direct slot is free, so place directly under the sponsor on that side.
            (placedUnderId, actualPlacedLeft) = _placeInForcedSlot(newId, placementSponsorId, weakLeft);
        } else {
            // Weak-leg direct slot is occupied, so continue placement with normal BFS under that subtree.
            (placedUnderId, actualPlacedLeft) = _placeInSpecifiedSlot(newId, weakChild);
        }

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

        (uint256 tokenAmount, uint8 appliedBoxId) = _allocateTokensForCurrentBox(newId, packageAmount);
        activeBoxByUser[newId] = appliedBoxId;
        tokenAllocationsByUser[newId] += tokenAmount;
        totalTokenDistributed += tokenAmount;

        usersById[placementSponsorId].directReferrals += 1;
        usersById[placementSponsorId].totalTeamBusiness += packageAmount;
        directReferralsByUser[placementSponsorId].push(newId);
        referralCountByPkg[placementSponsorId][1] += 1;

        if (binaryTreeContract != address(0)) {
            IMetaGuildXBinaryTree(binaryTreeContract).refreshLevelEligibility(
                placementSponsorId,
                usersById[placementSponsorId].directReferrals,
                usersById[placementSponsorId].sponsorId
            );
        }

        try IMetaGuildXRouter(incomeRouterContract).distributeJoinIncome(
            newId,
            placementSponsorId,
            placedUnderId,
            packageAmount,
            paymentAsset,
            originalUserId
        ) {
            _distributeCashbackAndCreator(packageAmount, paymentAsset);
        } catch {
            failedDistribution[newId] = true;
            failedUserIds.push(newId);
            emit DistributionFailed(newId, block.timestamp);
        }

        emit UserRegistered(newId, placementSponsorId, wallet, 1, packageAmount, placedUnderId, actualPlacedLeft);
        emit RebirthUserCreated(originalUserId, newId, wallet);
        return newId;
    }

    function surrenderForCashback(uint256 userId) external nonReentrant {
        MGXTypes.UserProfile storage user = usersById[userId];
        if (user.account != msg.sender) revert NotOwnerOfUser();

        uint256 joinedAt = user.joinedAt;
        uint256 currentTime = block.timestamp;

        if (currentTime < joinedAt + 90 days) revert NotYetAvailable();
        if (currentTime > joinedAt + 180 days) revert WindowExpired();

        uint256 mgx = tokenAllocationsByUser[userId];
        if (mgx > 0) {
            futurePool += mgx;
            tokenAllocationsByUser[userId] = 0;
        }

        if (binaryTreeContract != address(0)) {
            IMetaGuildXBinaryTree(binaryTreeContract).handleSurrender(userId);
        }
        ICashbackPool(cashbackPoolContract).surrenderForCashback(msg.sender, userId);
    }

    function claimCashback(uint256 userId) external {
        if (msg.sender != this.getUserWallet(userId)) revert NotUser();
        ICashbackPool(cashbackPoolContract).claimCashback(msg.sender, userId);
    }

    function finalizeCashbackSurrender(
        uint256 userId,
        address
    ) external view returns (uint256 platformAmount, uint256 settlementAmount) {
        if (msg.sender != cashbackPoolContract) revert OnlyCashbackPool();
        userId;
        return (0, 0);
    }

    function stake(uint256 amount, uint256 duration, bool autoCompound) external nonReentrant {
        uint256 userId = userIdByAddress[msg.sender];
        if (userId == 0) revert UserNotRegistered();
        if (!activeUsers[userId]) revert UserNotActive();
        IMGXStaking(stakingContract).stakeFor(msg.sender, amount, 0, duration, autoCompound, defaultPaymentAsset);
    }

    function claimStakingReward() external nonReentrant {
        uint256 userId = userIdByAddress[msg.sender];
        if (userId == 0) revert UserNotRegistered();
        if (!activeUsers[userId]) revert UserNotActive();
        IMGXStaking(stakingContract).claimFor(msg.sender);
    }

    function compoundStakingReward() external nonReentrant {
        uint256 userId = userIdByAddress[msg.sender];
        if (userId == 0) revert UserNotRegistered();
        if (!activeUsers[userId]) revert UserNotActive();
        IMGXStaking(stakingContract).compoundFor(msg.sender);
    }

    function withdrawStake(uint256 amount) external nonReentrant {
        uint256 userId = userIdByAddress[msg.sender];
        if (userId == 0) revert UserNotRegistered();
        if (!activeUsers[userId]) revert UserNotActive();
        IMGXStaking(stakingContract).withdrawFor(msg.sender, amount);
    }

    function setPlacementSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert InvalidSigner();
        placementSigner = signer;
    }

    function setBinaryTreeContract(address target) external onlyOwner {
        _validateContract(target);
        binaryTreeContract = target;
    }

    function setMgxTokenAddress(address target) external onlyOwner {
        mgxTokenAddress = target;
    }

    function setUsdtAddress(address target) external onlyOwner {
        usdtAddress = target;
    }

    function setDefaultPaymentAsset(address target) external onlyOwner {
        defaultPaymentAsset = target;
    }

    function setIncomeRouterContract(address target) external onlyOwner {
        _validateContract(target);
        incomeRouterContract = target;
    }

    function setIncomeEngineContract(address target) external onlyOwner {
        _validateContract(target);
        incomeEngineContract = target;
    }

    function setUpgradeEngineContract(address target) external onlyOwner {
        _validateContract(target);
        upgradeEngineContract = target;
    }

    function setCreatorFeeWallet(address target) external onlyOwner {
        if (target == address(0)) revert InvalidRecipient();
        creatorFeeWallet = target;
    }

    function setCashbackPoolContract(address target) external onlyOwner {
        _validateContract(target);
        cashbackPoolContract = target;
    }

    function setTokenEngineContract(address target) external onlyOwner {
        _validateContract(target);
        tokenEngineContract = target;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function adminBackfillTree(uint256 userId, uint256 parentId, bool isLeft) external onlyOwner {
        if (userId == 0) revert InvalidUserId();
        if (parentId == 0) revert InvalidParentId();
        if (binaryTreeContract == address(0)) revert TreeNotSet();
        IMetaGuildXBinaryTree(binaryTreeContract).placeNodeExact(parentId, userId, isLeft);
    }

    function setStakingContract(address target) external onlyOwner {
        if (target == address(0)) revert InvalidAddress();
        stakingContract = target;
    }

    function setActiveUser(uint256 userId, bool active) external onlyOwner {
        if (usersById[userId].id == 0) revert UserNotFound(userId);
        activeUsers[userId] = active;
    }

    function setProductionMode(bool enabled, address paymentAsset) external onlyOwner {
        productionMode = enabled;
        defaultPaymentAsset = paymentAsset;
    }

    function adminReleaseStrandedEscrow(uint256 userId) external onlyOwner {
        IMetaGuildXIncome(incomeEngineContract).releaseStrandedEscrow(userId, defaultPaymentAsset);
    }

    function adminSweepToCreator(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert NothingToSweep();
        _safeTransferExact(token, creatorFeeWallet, bal, "TRANSFER_FAILED");
    }

    function adminSweepAmountToCreator(
        address token,
        uint256 amount
    ) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal < amount) revert InsufficientBalance();
        _safeTransferExact(token, creatorFeeWallet, amount, "TRANSFER_FAILED");
    }

    function adminResetAndRebuildLevelTree(
        uint256[] calldata userIds,
        uint256[] calldata sponsorIds
    ) external onlyOwner {
        if (userIds.length != sponsorIds.length) revert LengthMismatch();
        if (binaryTreeContract == address(0)) revert NoTree();
        MetaGuildXPlacementLib.rebuildLevelTree(binaryTreeContract, userIds, sponsorIds, nextUserId > 0 ? nextUserId - 1 : 0);
    }

    function adminRetryDistribution(uint256 userId) external onlyOwner {
        if (!failedDistribution[userId]) revert NotFailedDistribution(userId);

        address paymentAsset = userPrimaryAsset[userId];
        if (paymentAsset == address(0)) {
            paymentAsset = defaultPaymentAsset;
        }
        _retryDistributionForUser(userId, paymentAsset);
    }

    function getFailedUserIds() external view returns (uint256[] memory) {
        return failedUserIds;
    }

    function configurePaymentAsset(address asset, bool enabled, bool isNative, uint256 unitPrice) external onlyOwner {
        if (!isNative) {
            _validateContract(asset);
        }
        enabledPaymentAssets[asset] = enabled;
        nativePaymentAssets[asset] = isNative;
        paymentAssetUnitPrice[asset] = unitPrice;
    }

    function _applyPackageUpgrade(uint256 userId, uint8 newPackageLevel, address paymentAsset, uint256 upgradeAmount) internal {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0) revert UserNotFound(userId);
        if (newPackageLevel != profile.packageLevel + 1) revert UpgradeOnlyToNextLevel();

        uint8 previousLevel = profile.packageLevel;
        profile.packageLevel = newPackageLevel;
        profile.totalContribution += upgradeAmount;
        if (paymentAsset != address(0)) {
            userPrimaryAsset[userId] = paymentAsset;
        }

        (uint256 tokenAmount, uint8 appliedBoxId) = _allocateTokensForCurrentBox(userId, upgradeAmount);
        activeBoxByUser[userId] = appliedBoxId;
        tokenAllocationsByUser[userId] += tokenAmount;
        totalTokenDistributed += tokenAmount;

        uint256 sponsorId = profile.sponsorId;
        uint8 newPkg = profile.packageLevel;
        if (sponsorId != 0) {
            referralCountByPkg[sponsorId][newPkg] += 1;
        }

        IMetaGuildXRouter(incomeRouterContract).distributeUpgradeIncome(
            userId,
            profile.sponsorId,
            upgradeAmount,
            paymentAsset
        );
        _distributeCashbackAndCreator(upgradeAmount, paymentAsset);

        emit PackageUpgraded(userId, previousLevel, newPackageLevel, upgradeAmount);
    }

    function _retryDistributionForUser(uint256 userId, address paymentAsset) internal {
        MGXTypes.UserProfile storage profile = usersById[userId];
        if (profile.id == 0) revert UserNotFound(userId);

        uint256 packageAmount = packagePricesArray[profile.packageLevel - 1];
        uint256 placedUnderId = IMetaGuildXBinaryTree(binaryTreeContract).getParent(userId);
        uint256 settlementAmt = _platformToSettlement(paymentAsset, packageAmount);
        uint256 coreBal = IERC20(paymentAsset).balanceOf(address(this));
        if (coreBal < settlementAmt) revert InsufficientCoreBalance();

        try IMetaGuildXRouter(incomeRouterContract).distributeJoinIncome(
            userId,
            profile.sponsorId,
            placedUnderId,
            packageAmount,
            paymentAsset,
            0
        ) {
            failedDistribution[userId] = false;
            _distributeCashbackAndCreator(packageAmount, paymentAsset);
            emit DistributionRetried(userId, true);
        } catch (bytes memory reason) {
            emit DistributionRetried(userId, false);
            emit DistributionFailedReason(userId, reason);
        }
    }

    function _createUserWithPlacement(
        address account,
        uint256 sponsorId,
        uint8 packageLevel,
        bool isReactivation,
        address paymentAsset,
        uint256 forcedParentId,
        bool forceLeft
    ) internal returns (uint256 userId) {
        userId = nextUserId++;
        uint256 packageAmount = packagePricesArray[packageLevel - 1];
        uint256 placedUnderId;
        bool actualPlacedLeft;
        if (forcedParentId != 0) {
            (placedUnderId, actualPlacedLeft) = _placeInForcedSlot(userId, forcedParentId, forceLeft);
        } else {
            (placedUnderId, actualPlacedLeft) = _placeInSpecifiedSlot(userId, sponsorId);
        }

        usersById[userId] = MGXTypes.UserProfile({
            id: userId,
            account: account,
            sponsorId: sponsorId,
            packageLevel: packageLevel,
            originalPackageLevel: packageLevel,
            totalContribution: packageAmount,
            totalEarnings: 0,
            directReferrals: 0,
            totalTeamBusiness: 0,
            rebirthCount: 0,
            xCount: 0,
            joinedAt: block.timestamp,
            surrendered: false
        });
        activeUsers[userId] = true;

        if (!isReactivation) {
            userIdByAddress[account] = userId;
        } else {
            usersById[userId].rebirthCount = 1;
        }

        if (paymentAsset != address(0)) {
            userPrimaryAsset[userId] = paymentAsset;
        }

        (uint256 tokenAmount, uint8 appliedBoxId) = _allocateTokensForCurrentBox(userId, packageAmount);
        activeBoxByUser[userId] = appliedBoxId;
        tokenAllocationsByUser[userId] += tokenAmount;
        totalTokenDistributed += tokenAmount;

        if (sponsorId != 0) {
            usersById[sponsorId].directReferrals += 1;
            usersById[sponsorId].totalTeamBusiness += packageAmount;
            directReferralsByUser[sponsorId].push(userId);
            referralCountByPkg[sponsorId][packageLevel] += 1;

            if (binaryTreeContract != address(0)) {
                IMetaGuildXBinaryTree(binaryTreeContract).refreshLevelEligibility(
                    sponsorId,
                    usersById[sponsorId].directReferrals,
                    usersById[sponsorId].sponsorId
                );
            }
        } else {
            rootUserId = userId;
        }

        try IMetaGuildXRouter(incomeRouterContract).distributeJoinIncome(
            userId,
            sponsorId,
            placedUnderId,
            packageAmount,
            paymentAsset,
            0
        ) {
            _distributeCashbackAndCreator(packageAmount, paymentAsset);
        } catch (bytes memory reason) {
            failedDistribution[userId] = true;
            failedUserIds.push(userId);
            emit DistributionFailed(userId, block.timestamp);
            emit DistributionFailedReason(userId, reason);
        }

        emit UserRegistered(userId, sponsorId, account, packageLevel, packageAmount, placedUnderId, actualPlacedLeft);
    }

    function _distributeCashbackAndCreator(uint256 packageAmount, address paymentAsset) internal {
        uint256 cashbackPlatformShare = (packageAmount * CASHBACK_JOIN_SHARE_BPS) / 10_000;
        uint256 cashbackSettlementShare = paymentAsset == address(0)
            ? 0
            : (_platformToSettlement(paymentAsset, packageAmount) * CASHBACK_JOIN_SHARE_BPS) / 10_000;

        if (
            cashbackPoolContract != address(0) &&
            IMetaGuildXCashbackPool(cashbackPoolContract).totalSurrenderedUsers() > 0
        ) {
            IMetaGuildXCashbackPool(cashbackPoolContract).notifyCashbackAccrued(
                packageAmount,
                paymentAsset,
                cashbackSettlementShare
            );
        } else {
            _payoutCreatorAmount(cashbackPlatformShare, paymentAsset, creatorFeeWallet, 10_000);
        }

        _payoutCreatorAmount(packageAmount, paymentAsset, creatorFeeWallet, CREATOR_SHARE_BPS);
    }

    function _placeInSpecifiedSlot(uint256 userId, uint256 sponsorId) internal returns (uint256 placedUnderId, bool actualPlacedLeft) {
        return MetaGuildXPlacementLib.placeInSpecifiedSlot(binaryTreeContract, rootUserId, userId, sponsorId);
    }

    function _placeInForcedSlot(
        uint256 userId,
        uint256 parentId,
        bool forceLeft
    ) internal returns (uint256 placedUnderId, bool placedLeft) {
        return MetaGuildXPlacementLib.placeInForcedSlot(binaryTreeContract, userId, parentId, forceLeft);
    }

    function _findWeakLeg(uint256 uplineId) internal view returns (bool isLeft) {
        return MetaGuildXPlacementLib.findWeakLeg(binaryTreeContract, uplineId, MAX_SUBTREE_DEPTH);
    }

    function _getSubtreeCount(uint256 nodeId, uint256 depth) internal pure returns (uint256) {
        nodeId;
        depth;
        return 0;
    }

    function _allocateTokensForCurrentBox(
        uint256 userId,
        uint256 packageUsdAmount
    ) internal returns (uint256 allocatedTokens, uint8 appliedBoxId) {
        if (tokenEngineContract == address(0)) revert TokenEngineNotSet();
        return IMetaGuildXTokenEngine(tokenEngineContract).allocateTokens(userId, packageUsdAmount);
    }

    function _collectPayment(address paymentAsset, uint256 platformAmount) internal returns (uint256 settlementAmount) {
        _validatePaymentAsset(paymentAsset);
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

    function _payoutSettlement(address recipient, address paymentAsset, uint256 settlementAmount) internal {
        _validatePaymentAsset(paymentAsset);
        MetaGuildXPaymentLib.payoutSettlement(
            recipient,
            paymentAsset,
            nativePaymentAssets[paymentAsset],
            settlementAmount
        );

        emit PaymentWithdrawn(recipient, paymentAsset, 0, settlementAmount);
    }

    function _platformToSettlement(address paymentAsset, uint256 platformAmount) internal view returns (uint256) {
        return MetaGuildXPaymentLib.platformToSettlement(paymentAsset, paymentAssetUnitPrice[paymentAsset], platformAmount);
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

        address payoutRecipient = recipient == address(0) ? creatorFeeWallet : recipient;
        MetaGuildXPaymentLib.payoutCreatorAmount(
            paymentAsset,
            nativePaymentAssets[paymentAsset],
            paymentAssetUnitPrice[paymentAsset],
            platformAmount,
            payoutRecipient,
            bps
        );
        uint256 settlementAmount = (_platformToSettlement(paymentAsset, platformAmount) * bps) / 10_000;
        if (settlementAmount > 0) {
            emit PaymentWithdrawn(payoutRecipient, paymentAsset, 0, settlementAmount);
        }
    }

    function _validatePaymentAsset(address paymentAsset) internal view {
        if (!enabledPaymentAssets[paymentAsset]) revert PaymentAssetDisabled();
        if (!nativePaymentAssets[paymentAsset]) {
            _validateContract(paymentAsset);
        }
        if (paymentAssetUnitPrice[paymentAsset] == 0) revert PaymentAssetNotConfigured();
    }

    function _validateContract(address target) internal view {
        if (target == address(0) || target.code.length == 0) revert InvalidContract();
    }

    function _safeTransferFromExact(
        address token,
        address from,
        address to,
        uint256 amount,
        string memory errorMessage
    ) internal {
        MetaGuildXPaymentLib.safeTransferFromExact(token, from, to, amount, errorMessage);
    }

    function _safeTransferExact(address token, address to, uint256 amount, string memory errorMessage) internal {
        MetaGuildXPaymentLib.safeTransferExact(token, to, amount, errorMessage);
    }

    function _verifyPlacementSignature(
        address account,
        uint256 sponsorId,
        uint256 nonce,
        bytes calldata signature
    ) internal view {
        bytes32 structHash = keccak256(abi.encodePacked(block.chainid, address(this), account, sponsorId, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", structHash));
        if (_recoverSigner(digest, signature) != placementSigner) revert InvalidSignature();
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
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
        return signer;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256 public futurePool;
    mapping(uint256 => bool) public activeUsers;
    address public stakingContract;
    mapping(uint256 => bool) public failedDistribution;
    uint256[] public failedUserIds;
    address public tokenEngineContract;
    uint256[34] private __gap;
}
