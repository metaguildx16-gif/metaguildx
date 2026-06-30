// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./libraries/MGXTypes.sol";

interface IMetaGuildXAdminIncome {
    function releaseStrandedEscrow(uint256 userId, address paymentAsset) external;
}

library MetaGuildXAdminLib {
    event WalletMigrated(uint256 indexed userId, address indexed oldWallet, address indexed newWallet);

    error InvalidAddress();
    error UserNotRegistered();
    error AlreadyRegistered();
    error Unauthorized();
    error NothingToSweep();
    error ZeroAmount();
    error InsufficientBalance();

    function adminMigrateWallet(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(address => uint256) storage userIdByAddress,
        mapping(address => uint256) storage nonces,
        address oldWallet,
        address newWallet,
        uint256[] calldata rebirthUserIds
    ) external {
        if (oldWallet == address(0) || newWallet == address(0)) revert InvalidAddress();
        if (oldWallet == newWallet) revert InvalidAddress();
        uint256 primaryUserId = userIdByAddress[oldWallet];
        if (primaryUserId == 0) revert UserNotRegistered();
        if (userIdByAddress[newWallet] != 0) revert AlreadyRegistered();
        if (usersById[primaryUserId].account != oldWallet) revert Unauthorized();

        usersById[primaryUserId].account = newWallet;
        delete userIdByAddress[oldWallet];
        userIdByAddress[newWallet] = primaryUserId;
        delete nonces[oldWallet];

        emit WalletMigrated(primaryUserId, oldWallet, newWallet);

        for (uint256 i = 0; i < rebirthUserIds.length; i++) {
            uint256 rebirthId = rebirthUserIds[i];
            if (usersById[rebirthId].account == oldWallet) {
                usersById[rebirthId].account = newWallet;
                emit WalletMigrated(rebirthId, oldWallet, newWallet);
            }
        }
    }

    function adminReleaseStrandedEscrow(
        address incomeEngineContract,
        address defaultPaymentAsset,
        uint256 userId
    ) external {
        IMetaGuildXAdminIncome(incomeEngineContract).releaseStrandedEscrow(userId, defaultPaymentAsset);
    }

    function adminSweepToCreator(
        address token,
        address creatorFeeWallet
    ) external returns (uint256 bal) {
        bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert NothingToSweep();
        _safeTransferExact(token, creatorFeeWallet, bal, "TRANSFER_FAILED");
    }

    function adminSweepAmountToCreator(
        address token,
        address creatorFeeWallet,
        uint256 amount
    ) external {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal < amount) revert InsufficientBalance();
        _safeTransferExact(token, creatorFeeWallet, amount, "TRANSFER_FAILED");
    }

    function _safeTransferExact(address token, address recipient, uint256 amount, string memory errorMessage) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), errorMessage);
    }
}
