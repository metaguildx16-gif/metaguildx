// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library MetaGuildXPaymentLib {
    function collectPayment(
        address paymentAsset,
        bool isNativePayment,
        uint256 unitPrice,
        uint256 nativeValue,
        address payer,
        uint256 platformAmount
    ) external returns (uint256 settlementAmount) {
        settlementAmount = platformToSettlement(unitPrice, platformAmount);

        if (isNativePayment) {
            require(nativeValue == settlementAmount, "Invalid native payment");
        } else {
            require(nativeValue == 0, "Unexpected native payment");
            safeTransferFromExact(paymentAsset, payer, address(this), settlementAmount, "INCOME_TRANSFER_FAILED");
        }
    }

    function payoutSettlement(
        address recipient,
        address paymentAsset,
        bool isNativePayment,
        uint256 settlementAmount
    ) external {
        require(recipient != address(0), "Invalid recipient");

        if (isNativePayment) {
            (bool success, ) = payable(recipient).call{value: settlementAmount}("");
            require(success, "Native payout failed");
        } else {
            safeTransferExact(paymentAsset, recipient, settlementAmount, "TRANSFER_FAILED");
        }
    }

    function platformToSettlement(address, uint256 unitPrice, uint256 platformAmount) external pure returns (uint256) {
        return platformToSettlement(unitPrice, platformAmount);
    }

    function payoutCreatorAmount(
        address paymentAsset,
        bool isNativePayment,
        uint256 unitPrice,
        uint256 platformAmount,
        address recipient,
        uint256 bps
    ) external {
        if (paymentAsset == address(0) || platformAmount == 0) {
            return;
        }

        uint256 settlementAmount = (platformToSettlement(unitPrice, platformAmount) * bps) / 10_000;
        if (settlementAmount == 0) {
            return;
        }

        if (isNativePayment) {
            (bool success, ) = payable(recipient).call{value: settlementAmount}("");
            require(success, "Native payout failed");
        } else {
            safeTransferExact(paymentAsset, recipient, settlementAmount, "TRANSFER_FAILED");
        }
    }

    function safeTransferFromExact(
        address token,
        address from,
        address to,
        uint256 amount,
        string memory errorMessage
    ) public {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), errorMessage);
    }

    function safeTransferExact(address token, address to, uint256 amount, string memory errorMessage) public {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), errorMessage);
    }

    function platformToSettlement(uint256 unitPrice, uint256 platformAmount) private pure returns (uint256) {
        return platformAmount * unitPrice;
    }
}
