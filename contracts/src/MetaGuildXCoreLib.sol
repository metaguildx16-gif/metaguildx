// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./libs/MetaGuildXPaymentLib.sol";

interface IMetaGuildXCashbackPoolCore {
    function totalSurrenderedUsers() external view returns (uint256);
    function notifyCashbackAccrued(uint256,address,uint256) external;
    function distribute(address,bool) external returns (uint256);
}

library MetaGuildXCoreLib {

    event PaymentWithdrawn(address indexed recipient, address indexed asset, uint256 platformAmount, uint256 settlementAmount);

    uint256 private constant CASHBACK_JOIN_SHARE_BPS = 400;
    uint256 private constant CREATOR_SHARE_BPS       = 1000;

    function distributeCashbackAndCreator(
        uint256 packageAmount,
        address paymentAsset,
        address cashbackPoolContract,
        address creatorFeeWallet,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        mapping(address => bool) storage nativePaymentAssets,
        bool productionMode
    ) external {
        uint256 cashbackPlatformShare = (packageAmount * CASHBACK_JOIN_SHARE_BPS) / 10_000;
        uint256 cashbackSettlementShare = paymentAsset == address(0)
            ? 0
            : (MetaGuildXPaymentLib.platformToSettlement(
                paymentAsset, paymentAssetUnitPrice[paymentAsset], packageAmount
               ) * CASHBACK_JOIN_SHARE_BPS) / 10_000;

        if (
            cashbackPoolContract != address(0) &&
            IMetaGuildXCashbackPoolCore(cashbackPoolContract).totalSurrenderedUsers() > 0
        ) {
            IMetaGuildXCashbackPoolCore(cashbackPoolContract).notifyCashbackAccrued(
                packageAmount, paymentAsset, cashbackSettlementShare
            );
            if (paymentAsset != address(0)) {
                IMetaGuildXCashbackPoolCore(cashbackPoolContract).distribute(paymentAsset, productionMode);
            }
        } else {
            payoutCreatorAmount(
                cashbackPlatformShare, paymentAsset, creatorFeeWallet, 10_000,
                paymentAssetUnitPrice, nativePaymentAssets
            );
        }
        payoutCreatorAmount(
            packageAmount, paymentAsset, creatorFeeWallet, CREATOR_SHARE_BPS,
            paymentAssetUnitPrice, nativePaymentAssets
        );
    }

    function payoutCreatorAmount(
        uint256 platformAmount,
        address paymentAsset,
        address recipient,
        uint256 bps,
        mapping(address => uint256) storage paymentAssetUnitPrice,
        mapping(address => bool) storage nativePaymentAssets
    ) public {
        if (paymentAsset == address(0) || platformAmount == 0) return;
        address payoutRecipient = recipient == address(0) ? address(0) : recipient;
        if (payoutRecipient == address(0)) return;
        MetaGuildXPaymentLib.payoutCreatorAmount(
            paymentAsset,
            nativePaymentAssets[paymentAsset],
            paymentAssetUnitPrice[paymentAsset],
            platformAmount,
            payoutRecipient,
            bps
        );
        uint256 settlementAmount = (MetaGuildXPaymentLib.platformToSettlement(
            paymentAsset, paymentAssetUnitPrice[paymentAsset], platformAmount
        ) * bps) / 10_000;
        if (settlementAmount > 0) {
            emit PaymentWithdrawn(payoutRecipient, paymentAsset, 0, settlementAmount);
        }
    }
}
