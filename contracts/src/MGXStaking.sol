// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./utils/MetaGuildReentrancyGuardUpgradeable.sol";
import "./libraries/MGXTypes.sol";

interface IMGXStakingCore {
    function mgxTokenAddress() external view returns (address);
}

contract MGXStaking is Initializable, UUPSUpgradeable, OwnableUpgradeable, MetaGuildReentrancyGuardUpgradeable {
    uint256 public constant DAILY_RELEASE_BPS = 10;
    uint256 public constant ACTION_FEE_BPS = 2_000;
    uint256 public rewardPool;
    uint256 public totalStaked;

    mapping(address => MGXTypes.StakePosition) private positionsByAccount;
    mapping(address => address) public stakingAssetByAccount;
    mapping(address => uint256) public stakeSettlementBalance;
    mapping(address => uint256) public stakingRewardPoolAssetReserve;
    mapping(address => uint256) public stakingRewardPoolPlatformReserve;

    address public incomeContract;
    address public coreContract;

    event Staked(address indexed account, uint256 amount, uint256 lockDuration, bool autoCompound);
    event Claimed(address indexed account, uint256 amount, address indexed paymentAsset, uint256 settlementAmount);
    event Compounded(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount, uint256 fee, address indexed paymentAsset, uint256 settlementAmount);
    event RewardPoolFunded(uint256 amount, address indexed paymentAsset, uint256 settlementAmount);
    event StakingPoolFunded(address indexed funder, uint256 amount);
    event IncomeContractSet(address indexed incomeContractAddress);
    event CoreContractSet(address indexed coreContractAddress);
    event StakeCorrected(address indexed account, uint256 amount);
    event RewardRateSet(uint256 rewardRate);

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
        _setDefaultLockDays();
    }

    function initializeV2() external onlyOwner reinitializer(2) {
        uint256[] memory lockDays = new uint256[](5);
        uint256[] memory multipliers = new uint256[](5);
        lockDays[0] = 30;
        lockDays[1] = 90;
        lockDays[2] = 180;
        lockDays[3] = 365;
        lockDays[4] = 730;
        multipliers[0] = 100;
        multipliers[1] = 105;
        multipliers[2] = 110;
        multipliers[3] = 112;
        multipliers[4] = 115;
        _initializeV2(30, lockDays, multipliers);
    }

    function initializeV2(
        uint256 _rewardRate,
        uint256[] calldata lockDays,
        uint256[] calldata multipliers
    ) external onlyOwner reinitializer(2) {
        _initializeV2(_rewardRate, lockDays, multipliers);
    }

    // NOTE: initializeV3 sets treasury top-up config.
    // executeTopUp() is not yet implemented — these values are informational.
    function initializeV3() external onlyOwner reinitializer(3) {
        treasury = owner();
        minBalanceThreshold = 100_000 ether;
        topUpAmount = 300_000 ether;
        topUpCooldown = 12 hours;
    }

    // NOTE: initializeV3 sets treasury top-up config.
    // executeTopUp() is not yet implemented — these values are informational.
    function initializeV3(
        address _treasury,
        uint256 _threshold,
        uint256 _topUp
    ) external onlyOwner reinitializer(3) {
        treasury = _treasury;
        minBalanceThreshold = _threshold;
        topUpAmount = _topUp;
        topUpCooldown = 12 hours;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    function setLockMultipliers(
        uint256[] calldata lockDays,
        uint256[] calldata multipliers
    ) external onlyOwner {
        require(lockDays.length == multipliers.length, "Length mismatch");
        delete validLockDays;
        for (uint256 i = 0; i < lockDays.length; i++) {
            validLockDays.push(lockDays[i]);
            lockMultiplier[lockDays[i]] = multipliers[i];
        }
    }

    function setRewardRate(uint256 _rewardRate) external onlyOwner {
        require(_rewardRate >= 1 && _rewardRate <= 100, "Rate must be 1-100 bps");
        rewardRate = _rewardRate;
        emit RewardRateSet(_rewardRate);
    }

    function initializeV4() external onlyOwner reinitializer(4) {
        uint256[] memory lockDays = new uint256[](5);
        uint256[] memory multipliers = new uint256[](5);
        lockDays[0] = 30;
        lockDays[1] = 90;
        lockDays[2] = 180;
        lockDays[3] = 365;
        lockDays[4] = 730;
        multipliers[0] = 100;
        multipliers[1] = 105;
        multipliers[2] = 110;
        multipliers[3] = 112;
        multipliers[4] = 115;
        _initializeV2(30, lockDays, multipliers);
    }

    function setIncomeContract(address incomeContractAddress) external onlyOwner {
        _validateContract(incomeContractAddress);
        incomeContract = incomeContractAddress;
        emit IncomeContractSet(incomeContractAddress);
    }

    function setCoreContract(address coreContractAddress) external onlyOwner {
        _validateContract(coreContractAddress);
        coreContract = coreContractAddress;
        emit CoreContractSet(coreContractAddress);
    }

    function fundRewardPool(uint256 amount, address paymentAsset, uint256 settlementAmount) external onlyCore {
        require(amount > 0, "Amount must be positive");

        rewardPool += amount;
        if (paymentAsset != address(0)) {
            stakingRewardPoolPlatformReserve[paymentAsset] += amount;
            stakingRewardPoolAssetReserve[paymentAsset] += settlementAmount;
        }

        emit RewardPoolFunded(amount, paymentAsset, settlementAmount);
    }

    function adminFundStakingPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be positive");

        address mgx = _getMgxToken();
        require(mgx != address(0), "MGX not set");

        bool success = IERC20(mgx).transferFrom(msg.sender, address(this), amount);
        require(success, "MGX transfer failed");

        rewardPool += amount;
        stakingRewardPoolPlatformReserve[mgx] += amount;
        stakingRewardPoolAssetReserve[mgx] += amount;
        emit StakingPoolFunded(msg.sender, amount);
    }

    function getTreasuryStatus() external view returns (uint256 treasuryBalance, uint256 allowance) {
        address currentTreasury = treasury;
        address mgx = _getMgxToken();
        if (currentTreasury == address(0) || mgx == address(0)) {
            return (0, 0);
        }

        treasuryBalance = IERC20(mgx).balanceOf(currentTreasury);
        allowance = IERC20(mgx).allowance(currentTreasury, address(this));
    }

    function stakeFor(
        address account,
        uint256 amount,
        uint256 settlementAmount,
        uint256 lockDuration,
        bool autoCompound,
        address paymentAsset
    ) external onlyCore nonReentrant returns (uint256 autoCompoundedReward) {
        require(account != address(0), "Invalid account");
        require(amount > 0, "Amount must be positive");
        bool validDuration = false;
        for (uint256 i = 0; i < validLockDays.length; i++) {
            if (lockDuration == validLockDays[i]) {
                validDuration = true;
                break;
            }
        }
        require(validDuration, "Invalid duration");

        address mgxToken = _getMgxToken();
        require(mgxToken != address(0), "MGX not set");
        bool success = IERC20(mgxToken).transferFrom(account, address(this), amount);
        require(success, "MGX transfer failed");

        _ensureMigratedPositions(account);
        (autoCompoundedReward, ) = _accrueAllRewards(account);

        if (paymentAsset != address(0)) {
            address existingAsset = stakingAssetByAccount[account];
            require(existingAsset == address(0) || existingAsset == paymentAsset, "Stake asset mismatch");
            stakingAssetByAccount[account] = paymentAsset;
        }

        totalStaked += amount;
        require(positionsByAccountV2[account].length < 20, "Max positions reached");
        positionsByAccountV2[account].push(
            MGXTypes.StakePosition({
                amount: amount,
                rewardDebt: block.timestamp,
                accruedReward: 0,
                lockStartedAt: block.timestamp,
                lockDuration: lockDuration,
                autoCompound: autoCompound
            })
        );
        positionSettlementBalancesByAccount[account].push(paymentAsset != address(0) ? settlementAmount : 0);
        _syncLegacyPosition(account);

        emit Staked(account, amount, lockDuration, autoCompound);
    }

    function getPositionCount(address account) external view returns (uint256) {
        if (positionsByAccountV2[account].length > 0) {
            return positionsByAccountV2[account].length;
        }

        MGXTypes.StakePosition memory legacy = positionsByAccount[account];
        return legacy.amount > 0 ? 1 : 0;
    }

    function getStakePositions(address account) external view returns (MGXTypes.StakePosition[] memory positions) {
        uint256 count = positionsByAccountV2[account].length;
        if (count > 0) {
            positions = new MGXTypes.StakePosition[](count);
            for (uint256 i = 0; i < count; i++) {
                positions[i] = positionsByAccountV2[account][i];
            }
            return positions;
        }

        MGXTypes.StakePosition memory legacy = positionsByAccount[account];
        if (legacy.amount > 0) {
            positions = new MGXTypes.StakePosition[](1);
            positions[0] = legacy;
            return positions;
        }

        return new MGXTypes.StakePosition[](0);
    }

    function claimReward(
        address account,
        uint256 index
    ) external onlyCore nonReentrant returns (uint256 reward, address paymentAsset, uint256 settlementAmount, uint256 autoCompoundedReward) {
        require(account != address(0), "Invalid account");
        _ensureMigratedPositions(account);
        require(index < positionsByAccountV2[account].length, "Invalid index");

        (autoCompoundedReward, ) = _accrueRewardForPosition(account, index);

        MGXTypes.StakePosition storage position = positionsByAccountV2[account][index];
        reward = position.accruedReward;
        require(reward > 0, "No reward");

        position.accruedReward = 0;
        uint256 fee;
        (reward, fee) = _applyRewardFee(reward);
        rewardPool += fee;
        paymentAsset = stakingAssetByAccount[account];
        if (paymentAsset != address(0)) {
            settlementAmount = _consumeRewardReserve(paymentAsset, reward);
        } else if (reward > 0) {
            address mgxToken = _getMgxToken();
            require(mgxToken != address(0), "MGX not set");
            bool success = IERC20(mgxToken).transfer(account, reward);
            require(success, "MGX transfer failed");
        }

        _syncLegacyPosition(account);
        emit Claimed(account, reward, paymentAsset, settlementAmount);
    }

    function compound(
        address account,
        uint256 index
    ) external onlyCore nonReentrant returns (uint256 reward, uint256 autoCompoundedReward) {
        require(account != address(0), "Invalid account");
        _ensureMigratedPositions(account);
        require(index < positionsByAccountV2[account].length, "Invalid index");

        (autoCompoundedReward, ) = _accrueRewardForPosition(account, index);

        MGXTypes.StakePosition storage position = positionsByAccountV2[account][index];
        reward = position.accruedReward;
        require(reward > 0, "No reward");

        position.accruedReward = 0;
        uint256 fee;
        (reward, fee) = _applyRewardFee(reward);
        rewardPool += fee;
        position.amount += reward;
        totalStaked += reward;

        address paymentAsset = stakingAssetByAccount[account];
        if (paymentAsset != address(0)) {
            uint256 settlementAmount = _consumeRewardReserve(paymentAsset, reward);
            positionSettlementBalancesByAccount[account][index] += settlementAmount;
        }

        _syncLegacyPosition(account);
        emit Compounded(account, reward);
    }

    function withdraw(
        address account,
        uint256 index
    ) external onlyCore nonReentrant returns (uint256 amountAfterFee, address paymentAsset, uint256 settlementCredit, uint256 fee, uint256 autoCompoundedReward) {
        require(account != address(0), "Invalid account");
        _ensureMigratedPositions(account);
        require(index < positionsByAccountV2[account].length, "Invalid index");

        MGXTypes.StakePosition storage position = positionsByAccountV2[account][index];
        require(position.amount > 0, "Invalid amount");
        require(block.timestamp >= _unlockAt(position.lockStartedAt, position.lockDuration), "Stake locked");

        (autoCompoundedReward, ) = _accrueRewardForPosition(account, index);

        fee = 0;
        amountAfterFee = position.amount;
        totalStaked -= position.amount;

        paymentAsset = stakingAssetByAccount[account];
        if (paymentAsset != address(0)) {
            settlementCredit = positionSettlementBalancesByAccount[account][index];
        }

        _removePosition(account, index);
        _syncLegacyPosition(account);
        if (paymentAsset == address(0) && amountAfterFee > 0) {
            address mgxToken = _getMgxToken();
            require(mgxToken != address(0), "MGX not set");
            bool success = IERC20(mgxToken).transfer(account, amountAfterFee);
            require(success, "MGX transfer failed");
        }
        emit Withdrawn(account, amountAfterFee, fee, paymentAsset, settlementCredit);
    }

    function claimFor(
        address account
    ) external onlyCore nonReentrant returns (uint256 reward, address paymentAsset, uint256 settlementAmount, uint256 autoCompoundedReward) {
        require(account != address(0), "Invalid account");
        (autoCompoundedReward, ) = _accrueAllRewards(account);

        uint256 count = positionsByAccountV2[account].length;
        if (count == 0) {
            MGXTypes.StakePosition storage legacyPosition = positionsByAccount[account];
            reward = legacyPosition.accruedReward;
            legacyPosition.accruedReward = 0;
        } else {
            for (uint256 i = 0; i < count; i++) {
                MGXTypes.StakePosition storage position = positionsByAccountV2[account][i];
                reward += position.accruedReward;
                position.accruedReward = 0;
            }
            _syncLegacyPosition(account);
        }
        require(reward > 0, "No reward");

        uint256 fee;
        // 20% fee applies only when rewards are claimed out.
        (reward, fee) = _applyRewardFee(reward);
        rewardPool += fee;
        paymentAsset = stakingAssetByAccount[account];
        if (paymentAsset != address(0)) {
            settlementAmount = _consumeRewardReserve(paymentAsset, reward);
        } else {
            address mgxToken = _getMgxToken();
            require(mgxToken != address(0), "MGX not set");
            bool success = IERC20(mgxToken).transfer(account, reward);
            require(success, "MGX transfer failed");
        }

        emit Claimed(account, reward, paymentAsset, settlementAmount);
    }

    function compoundFor(address account) external onlyCore nonReentrant returns (uint256 reward, uint256 autoCompoundedReward) {
        require(account != address(0), "Invalid account");
        (autoCompoundedReward, ) = _accrueAllRewards(account);

        uint256 count = positionsByAccountV2[account].length;
        if (count == 0) {
            MGXTypes.StakePosition storage legacyPosition = positionsByAccount[account];
            reward = legacyPosition.accruedReward;
            legacyPosition.accruedReward = 0;
        } else {
            for (uint256 i = 0; i < count; i++) {
                MGXTypes.StakePosition storage position = positionsByAccountV2[account][i];
                reward += position.accruedReward;
                position.accruedReward = 0;
            }
        }
        require(reward > 0, "No reward");

        uint256 fee;
        // 20% fee applies only when rewards are auto-compounded.
        (reward, fee) = _applyRewardFee(reward);
        rewardPool += fee;
        if (count == 0) {
            positionsByAccount[account].amount += reward;
        } else {
            positionsByAccountV2[account][0].amount += reward;
        }
        totalStaked += reward;

        address paymentAsset = stakingAssetByAccount[account];
        if (paymentAsset != address(0)) {
            uint256 settlementAmount = _consumeRewardReserve(paymentAsset, reward);
            stakeSettlementBalance[account] += settlementAmount;
        }

        _syncLegacyPosition(account);
        emit Compounded(account, reward);
    }

    function withdrawFor(
        address account,
        uint256 amount
    )
        external
        onlyCore
        nonReentrant
        returns (uint256 amountAfterFee, address paymentAsset, uint256 settlementCredit, uint256 fee, uint256 autoCompoundedReward)
    {
        require(account != address(0), "Invalid account");
        require(amount > 0, "Invalid amount");

        fee = 0;
        amountAfterFee = amount;
        paymentAsset = stakingAssetByAccount[account];

        if (positionsByAccountV2[account].length > 0) {
            (
                uint256 aggregateAmount,
                ,
                ,
                uint256 lockStartedAt,
                uint256 lockDuration,
                bool autoCompound
            ) = _aggregateStakePosition(account);
            autoCompound;
            require(aggregateAmount >= amount, "Invalid amount");
            require(block.timestamp >= _unlockAt(lockStartedAt, lockDuration), "Stake locked");

            (autoCompoundedReward, ) = _accrueAllRewards(account);

            uint256 remaining = amount;
            uint256 index = positionsByAccountV2[account].length;
            while (remaining > 0 && index > 0) {
                index -= 1;
                MGXTypes.StakePosition storage positionV2 = positionsByAccountV2[account][index];
                uint256 withdrawFromPosition = positionV2.amount > remaining ? remaining : positionV2.amount;
                positionV2.amount -= withdrawFromPosition;
                remaining -= withdrawFromPosition;

                if (positionV2.amount == 0) {
                    _removePosition(account, index);
                }
            }

            totalStaked -= amount;

            if (paymentAsset != address(0)) {
                (uint256 settlementConsumed, , uint256 settlementNet) = _consumeStakeSettlement(account, amount, fee);
                settlementCredit = settlementNet;
                _syncLegacyPosition(account);
                if (settlementConsumed > 0 && positionsByAccount[account].amount == 0) {
                    stakingAssetByAccount[account] = address(0);
                }
            } else {
                _syncLegacyPosition(account);
            }

            if (paymentAsset == address(0) && amountAfterFee > 0) {
                address mgxToken = _getMgxToken();
                require(mgxToken != address(0), "MGX not set");
                bool success = IERC20(mgxToken).transfer(account, amountAfterFee);
                require(success, "MGX transfer failed");
            }

            emit Withdrawn(account, amountAfterFee, fee, paymentAsset, settlementCredit);
            return (amountAfterFee, paymentAsset, settlementCredit, fee, autoCompoundedReward);
        }

        MGXTypes.StakePosition storage position = positionsByAccount[account];
        require(position.amount >= amount, "Invalid amount");
        require(block.timestamp >= _unlockAt(position.lockStartedAt, position.lockDuration), "Stake locked");

        (autoCompoundedReward, ) = _accrueReward(account);

        position.amount -= amount;
        totalStaked -= amount;

        if (paymentAsset != address(0)) {
            (uint256 settlementConsumed, , uint256 settlementNet) = _consumeStakeSettlement(account, amount, fee);
            settlementCredit = settlementNet;
            if (settlementConsumed > 0 && position.amount == 0) {
                stakingAssetByAccount[account] = address(0);
            }
        }

        if (paymentAsset == address(0) && amountAfterFee > 0) {
            address mgxToken = _getMgxToken();
            require(mgxToken != address(0), "MGX not set");
            bool success = IERC20(mgxToken).transfer(account, amountAfterFee);
            require(success, "MGX transfer failed");
        }

        emit Withdrawn(account, amountAfterFee, fee, paymentAsset, settlementCredit);
    }

    function adminCorrectStake(address account, uint256 amount) external onlyOwner nonReentrant {
        revert("Removed: migration only");
    }

    function pendingStakingReward(address account) external view returns (uint256) {
        if (positionsByAccountV2[account].length > 0) {
            uint256 combinedReward;
            for (uint256 i = 0; i < positionsByAccountV2[account].length; i++) {
                combinedReward += _previewNetRewardForPosition(account, i);
            }
            return combinedReward;
        }
        return _previewNetReward(account);
    }

    function getStakePosition(
        address account
    )
        external
        view
        returns (uint256 amount, uint256 rewardDebt, uint256 accruedReward, uint256 lockStartedAt, uint256 lockDuration, bool autoCompound)
    {
        if (positionsByAccountV2[account].length > 0) {
            (
                amount,
                rewardDebt,
                accruedReward,
                lockStartedAt,
                lockDuration,
                autoCompound
            ) = _aggregateStakePosition(account);
            return (amount, rewardDebt, accruedReward, lockStartedAt, lockDuration, autoCompound);
        }

        MGXTypes.StakePosition memory position = positionsByAccount[account];
        amount = position.amount;
        rewardDebt = position.rewardDebt;
        accruedReward = position.accruedReward;
        lockStartedAt = position.lockStartedAt;
        lockDuration = position.lockDuration;
        autoCompound = position.autoCompound;
    }

    function previewDailyRelease() external view returns (uint256) {
        return (totalStaked * rewardRate) / 10_000;
    }

    function _ensureMigratedPositions(address account) internal {
        if (positionsByAccountV2[account].length > 0) {
            return;
        }

        MGXTypes.StakePosition memory legacy = positionsByAccount[account];
        if (legacy.amount == 0 && legacy.accruedReward == 0 && legacy.lockStartedAt == 0) {
            return;
        }

        positionsByAccountV2[account].push(legacy);
        positionSettlementBalancesByAccount[account].push(stakeSettlementBalance[account]);
    }

    function _aggregateStakePosition(
        address account
    ) internal view returns (uint256 amount, uint256 rewardDebt, uint256 accruedReward, uint256 lockStartedAt, uint256 lockDuration, bool autoCompound) {
        MGXTypes.StakePosition[] storage positions = positionsByAccountV2[account];
        uint256 furthestUnlockAt;

        for (uint256 i = 0; i < positions.length; i++) {
            MGXTypes.StakePosition storage position = positions[i];
            amount += position.amount;
            accruedReward += position.accruedReward;
            if (position.rewardDebt > rewardDebt) {
                rewardDebt = position.rewardDebt;
            }
            if (position.autoCompound) {
                autoCompound = true;
            }

            uint256 unlockAt = _unlockAt(position.lockStartedAt, position.lockDuration);
            if (unlockAt >= furthestUnlockAt) {
                furthestUnlockAt = unlockAt;
                lockStartedAt = position.lockStartedAt;
                lockDuration = position.lockDuration;
            }
        }
    }

    function _syncLegacyPosition(address account) internal {
        if (positionsByAccountV2[account].length == 0) {
            delete positionsByAccount[account];
            stakeSettlementBalance[account] = 0;
            stakingAssetByAccount[account] = address(0);
            return;
        }

        (
            uint256 amount,
            uint256 rewardDebt,
            uint256 accruedReward,
            uint256 lockStartedAt,
            uint256 lockDuration,
            bool autoCompound
        ) = _aggregateStakePosition(account);

        positionsByAccount[account] = MGXTypes.StakePosition({
            amount: amount,
            rewardDebt: rewardDebt,
            accruedReward: accruedReward,
            lockStartedAt: lockStartedAt,
            lockDuration: lockDuration,
            autoCompound: autoCompound
        });

        uint256 settlementBalance;
        for (uint256 i = 0; i < positionSettlementBalancesByAccount[account].length; i++) {
            settlementBalance += positionSettlementBalancesByAccount[account][i];
        }
        stakeSettlementBalance[account] = settlementBalance;
    }

    function _removePosition(address account, uint256 index) internal {
        uint256 lastIndex = positionsByAccountV2[account].length - 1;
        if (index != lastIndex) {
            positionsByAccountV2[account][index] = positionsByAccountV2[account][lastIndex];
            positionSettlementBalancesByAccount[account][index] = positionSettlementBalancesByAccount[account][lastIndex];
        }

        positionsByAccountV2[account].pop();
        positionSettlementBalancesByAccount[account].pop();
    }

    function _accrueAllRewards(address account) internal returns (uint256 reward, bool compounded) {
        uint256 count = positionsByAccountV2[account].length;
        if (count == 0) {
            return _accrueReward(account);
        }

        for (uint256 i = 0; i < count; i++) {
            (uint256 positionReward, bool positionCompounded) = _accrueRewardForPosition(account, i);
            reward += positionReward;
            compounded = compounded || positionCompounded;
        }

        _syncLegacyPosition(account);
    }

    function _accrueRewardForPosition(address account, uint256 index) internal returns (uint256 reward, bool compounded) {
        MGXTypes.StakePosition storage position = positionsByAccountV2[account][index];
        if (position.amount == 0 || totalStaked == 0 || rewardPool == 0) {
            position.rewardDebt = block.timestamp;
            return (0, false);
        }

        uint256 previewReward = _previewRewardForPosition(account, index);
        reward = previewReward > position.accruedReward ? previewReward - position.accruedReward : 0;
        if (reward == 0) {
            return (0, false);
        }

        if (reward > rewardPool) {
            reward = rewardPool;
        }

        rewardPool -= reward;
        position.rewardDebt = block.timestamp;

        address paymentAsset = stakingAssetByAccount[account];
        if (position.autoCompound) {
            compounded = true;
            uint256 fee;
            (reward, fee) = _applyRewardFee(reward);
            rewardPool += fee;
            if (paymentAsset != address(0)) {
                uint256 settlementAmount = _consumeRewardReserve(paymentAsset, reward);
                positionSettlementBalancesByAccount[account][index] += settlementAmount;
            }
            position.amount += reward;
            totalStaked += reward;
            emit Compounded(account, reward);
        } else {
            position.accruedReward += reward;
        }
    }

    function _accrueReward(address account) internal returns (uint256 reward, bool compounded) {
        MGXTypes.StakePosition storage position = positionsByAccount[account];
        if (position.amount == 0 || totalStaked == 0 || rewardPool == 0) {
            position.rewardDebt = block.timestamp;
            return (0, false);
        }

        uint256 previewReward = _previewReward(account);
        reward = previewReward > position.accruedReward ? previewReward - position.accruedReward : 0;
        if (reward == 0) {
            return (0, false);
        }

        if (reward > rewardPool) {
            reward = rewardPool;
        }

        rewardPool -= reward;
        position.rewardDebt = block.timestamp;

        address paymentAsset = stakingAssetByAccount[account];
        if (position.autoCompound) {
            compounded = true;
            uint256 fee;
            (reward, fee) = _applyRewardFee(reward);
            rewardPool += fee;
            if (paymentAsset != address(0)) {
                uint256 settlementAmount = _consumeRewardReserve(paymentAsset, reward);
                stakeSettlementBalance[account] += settlementAmount;
            }
            position.amount += reward;
            totalStaked += reward;
            emit Compounded(account, reward);
        } else {
            position.accruedReward += reward;
        }
    }

    function _previewReward(address account) internal view returns (uint256) {
        MGXTypes.StakePosition memory position = positionsByAccount[account];
        if (position.amount == 0 || totalStaked == 0 || rewardPool == 0) {
            return position.accruedReward;
        }

        uint256 elapsed = position.rewardDebt == 0 ? 8 hours : block.timestamp - position.rewardDebt;
        uint256 elapsedCycles = elapsed / 8 hours;
        if (elapsedCycles == 0) {
            return position.accruedReward;
        }

        uint256 cycleRewardRate = rewardRate / 3;
        uint256 cycleRelease = (totalStaked * cycleRewardRate) / 10_000;
        uint256 baseReward = ((position.amount * cycleRelease) / totalStaked) * elapsedCycles;
        uint256 reward = _applyDurationModifier(baseReward, position.lockDuration);

        return position.accruedReward + reward;
    }

    function _previewRewardForPosition(address account, uint256 index) internal view returns (uint256) {
        MGXTypes.StakePosition memory position = positionsByAccountV2[account][index];
        if (position.amount == 0 || totalStaked == 0 || rewardPool == 0) {
            return position.accruedReward;
        }

        uint256 elapsed = position.rewardDebt == 0 ? 8 hours : block.timestamp - position.rewardDebt;
        uint256 elapsedCycles = elapsed / 8 hours;
        if (elapsedCycles == 0) {
            return position.accruedReward;
        }

        uint256 cycleRewardRate = rewardRate / 3;
        uint256 cycleRelease = (totalStaked * cycleRewardRate) / 10_000;
        uint256 baseReward = ((position.amount * cycleRelease) / totalStaked) * elapsedCycles;
        uint256 reward = _applyDurationModifier(baseReward, position.lockDuration);

        return position.accruedReward + reward;
    }

    function _previewNetReward(address account) internal view returns (uint256) {
        (uint256 netReward, ) = _applyRewardFee(_previewReward(account));
        return netReward;
    }

    function _previewNetRewardForPosition(address account, uint256 index) internal view returns (uint256) {
        (uint256 netReward, ) = _applyRewardFee(_previewRewardForPosition(account, index));
        return netReward;
    }

    function _applyDurationModifier(uint256 baseReward, uint256 lockDuration) internal view returns (uint256) {
        uint256 mult = lockMultiplier[lockDuration];
        if (mult == 0) {
            mult = 100;
        }
        return (baseReward * mult) / 100;
    }

    function _consumeRewardReserve(address paymentAsset, uint256 platformAmount) internal returns (uint256 settlementAmount) {
        require(stakingRewardPoolPlatformReserve[paymentAsset] >= platformAmount, "Insufficient reward reserve");
        uint256 platformReserve = stakingRewardPoolPlatformReserve[paymentAsset];
        uint256 assetReserve = stakingRewardPoolAssetReserve[paymentAsset];
        settlementAmount = platformAmount == platformReserve ? assetReserve : (assetReserve * platformAmount) / platformReserve;
        stakingRewardPoolPlatformReserve[paymentAsset] -= platformAmount;
        stakingRewardPoolAssetReserve[paymentAsset] -= settlementAmount;
    }

    function _applyRewardFee(uint256 reward) internal pure returns (uint256 netReward, uint256 fee) {
        fee = (reward * ACTION_FEE_BPS) / 10_000;
        netReward = reward - fee;
    }

    function _initializeV2(uint256 _rewardRate, uint256[] memory lockDays, uint256[] memory multipliers) internal {
        require(lockDays.length == multipliers.length, "Length mismatch");
        rewardRate = _rewardRate;
        _setLockDays(lockDays);
        for (uint256 i = 0; i < lockDays.length; i++) {
            lockMultiplier[lockDays[i]] = multipliers[i];
        }
    }

    function _setDefaultLockDays() internal {
        validLockDays.push(30);
        validLockDays.push(90);
        validLockDays.push(180);
        validLockDays.push(365);
        validLockDays.push(730);
    }

    function _setLockDays(uint256[] memory lockDays) internal {
        delete validLockDays;
        for (uint256 i = 0; i < lockDays.length; i++) {
            validLockDays.push(lockDays[i]);
        }
    }

    function _unlockAt(uint256 lockStartedAt, uint256 lockDuration) internal pure returns (uint256) {
        if (lockDuration >= 1 days) {
            return lockStartedAt + lockDuration;
        }
        return lockStartedAt + (lockDuration * 1 days);
    }

    function _getMgxToken() internal view returns (address) {
        if (coreContract == address(0)) {
            return address(0);
        }

        try IMGXStakingCore(coreContract).mgxTokenAddress() returns (address token) {
            return token;
        } catch {
            return address(0);
        }
    }

    function _consumeStakeSettlement(
        address account,
        uint256 amount,
        uint256 fee
    ) internal returns (uint256 settlementConsumed, uint256 settlementFee, uint256 settlementNet) {
        uint256 stakePlatformBalance = positionsByAccount[account].amount + amount;
        uint256 stakeAssetBalance = stakeSettlementBalance[account];
        settlementConsumed = amount == stakePlatformBalance ? stakeAssetBalance : (stakeAssetBalance * amount) / stakePlatformBalance;
        settlementFee = (settlementConsumed * fee) / amount;
        settlementNet = settlementConsumed - settlementFee;
        stakeSettlementBalance[account] -= settlementConsumed;
    }

    function _validateContract(address target) internal view {
        require(target != address(0), "Invalid contract");
        require(target.code.length > 0, "Target is not a contract");
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    mapping(address => MGXTypes.StakePosition[]) private positionsByAccountV2;
    mapping(address => uint256[]) private positionSettlementBalancesByAccount;
    uint256 public rewardRate;
    mapping(uint256 => uint256) public lockMultiplier;
    // NOTE: Treasury auto top-up is not yet implemented.
    // These variables are reserved for future use.
    // Do NOT remove — storage layout must be preserved for UUPS upgrades.
    // A guarded executeTopUp() function should be added in a future upgrade.
    address public treasury;
    uint256 public minBalanceThreshold; // Minimum rewardPool before top-up triggers
    uint256 public topUpAmount;         // Amount to top up per trigger
    uint256 public lastTopUpTime;       // Last top-up timestamp (cooldown tracking)
    uint256 public topUpCooldown;       // Minimum time between top-ups
    uint256[] public validLockDays;
    uint256[35] private __gap;
}
