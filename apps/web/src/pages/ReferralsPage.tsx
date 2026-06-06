import type { DashboardPageProps } from "./DashboardPageTypes";

export function ReferralsPage(props: DashboardPageProps) {
  const {
    activeLevelsCount,
    activeTreePreview,
    asMgx,
    availableStakeAmount,
    boxEarningsDisplay,
    canSubmitStake,
    canUpgradeCurrentPackage,
    canUseIndexedStakingActions,
    connectedWalletHistoryRows,
    connectedWalletTotalDisplay,
    directIncomeDisplay,
    directLeftNode,
    directRightNode,
    displayedMgxAllocated,
    displayedPendingStakingReward,
    displayedPersonalStaked,
    displayedStakePositions,
    displayedTotalMgxAllocated,
    displayedTotalStaked,
    earningsDashTab,
    escrowBalance,
    frozenEscrowDisplay,
    getDisplayName,
    handleCopyRebirthReferralLink,
    handleCopyReferralLink,
    handleCopyWalletAddress,
    handleLoadMoreHistory,
    handleLogout,
    handleRefreshRewards,
    handleRefreshSection,
    handleShareReferralLink,
    hasClaimableReward,
    hasWithdrawableStake,
    isConnectedWalletHistoryLoading,
    isConnectedWalletLoading,
    isLoading,
    isLoadingLevelTree,
    isLoadingRebirthDetails,
    isLoadingTreeDetails,
    isStakePending,
    LazyTreePanel,
    leftBranchNodes,
    levelIncomeDisplay,
    lockPeriods,
    metaguildx,
    mgxAllocationRows,
    mgxAvailableDisplay,
    navigateToRebirth,
    networkBonusDisplay,
    networkBonusHistoryRows,
    networkDashTab,
    nextUnlockReferralTarget,
    nextUpgradeLevel,
    opBnbGasDisplay,
    outerUsdtBalanceDisplay,
    parseDisplayNumber,
    privacySettings,
    profileMeta,
    profileSaved,
    rebirthBoxEarningsByPkg,
    rebirthDashView,
    rebirthEscrowProgress,
    rebirthFrozenAmount,
    rebirthGoBack,
    rebirthIncomeByUserId,
    rebirthNavStack,
    rebirthNeededAmount,
    rebirthNodeDetails,
    rebirthPkgLevel,
    rebirthProgressLabel,
    rebirthProgressPercent,
    rebirthProgressStep,
    rebirthRows,
    rebirthStatusLabel,
    rebirthTreePreview,
    rebirthXSlotStep,
    recentActivityRows,
    referralCopyStatus,
    referralGoalLabel,
    referralLink,
    referralSponsorId,
    referralSponsorProfile,
    registerForm,
    registrationSummary,
    regStep,
    renderSkeletonRows,
    rewardWindowReady,
    rightBranchNodes,
    runWalletAction,
    savePrivacy,
    saveProfileMeta,
    selectedFeaturedUser,
    selectedRebirthId,
    selectedRebirthRow,
    selectedTreeChildren,
    selectedTreeDetails,
    selectedTreeNode,
    selectedTreeParent,
    selectedTreePath,
    selectedTreeUserId,
    setActionFeedback,
    setDashboardView,
    setEarningsDashTab,
    setNetworkDashTab,
    setProfileMeta,
    setProfileSaved,
    setRebirthDashView,
    setRebirthNavStack,
    setRegisterForm,
    setSelectedRebirthId,
    setSelectedTreeUserId,
    setShowActivationConfirm,
    setStakeForm,
    setStatus,
    setTreeMode,
    setUserSearchQuery,
    setWalletMoveAmount,
    setWalletSubView,
    shortWalletAddress,
    showDashboardSkeleton,
    snapshot,
    spilloverIncomeDisplay,
    stakeableMgxAllocated,
    stakeForm,
    StakingSummary,
    Suspense,
    teamBusinessDisplay,
    totalMgxAllocatedDisplay,
    totalReceivedDisplay,
    totalTeamLabel,
    totalTeamMembers,
    transferFromBalance,
    transferFromLabel,
    transferToLabel,
    treeLevels,
    treeMode,
    upgradeMilestones,
    upgradeNeedDisplay,
    upgradeProgressPercent,
    upgradeRemainingDisplay,
    userDisplayNames,
    userLevelSummaryRows,
    userPackageLevel,
    userReferralRows,
    userSearchQuery,
    visibleLevelBreakdownRows,
    walletMoveAmount,
    walletSubView,
  } = props;
  return (
  <section className="panel dashboard-view w-full max-w-full">
    <p className="section-label">Referrals</p>
    <div className="summary-strip referrals-summary-strip flex flex-wrap gap-2 w-full max-w-full">
      <article className="summary-chip">
        <span>Total Direct Referrals</span>
        <strong>{snapshot.directReferrals}</strong>
      </article>
      <article className="summary-chip">
        <span>Total Team Business</span>
        <strong>${snapshot.totalTeamBusiness}</strong>
      </article>
    </div>
    <div className="referrals-layout">
      <article className="section-card referral-card-link">
        <div className="section-card-header">
          <h3 className="section-card-title">Your Referral Link</h3>
        </div>
        <div className="section-card-body">
          <div className="referral-link-box">
            <input
              className="referral-link-input"
              value={referralLink ?? "Connect wallet to generate your referral link"}
              readOnly
              aria-label="Referral link"
              title={referralLink ?? "Connect wallet to generate link"}
            />
            <button
              type="button"
              className="referral-copy-btn"
              onClick={handleCopyReferralLink}
              disabled={!referralLink}
            >
              <span aria-hidden="true">✦</span>
              <span>Copy</span>
            </button>
          </div>
          {referralCopyStatus ? <p className="copy-status-text">{referralCopyStatus}</p> : null}
        </div>
      </article>
    </div>
    <article className="section-card">
      <div className="section-card-header">
        <h3 className="section-card-title">Direct Referrals</h3>
      </div>
      <div className="section-card-body overflow-x-auto">
          <table className="referrals-table min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="text-gray-400">
              <tr>
                <th className="referrals-col-user">User ID</th>
                <th className="referrals-col-wallet referrals-wallet-col">Wallet</th>
                <th className="referrals-col-package">Package</th>
                <th className="referrals-col-joined">Joined</th>
                <th className="referrals-col-income">Your Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70">
              {userReferralRows.length > 0 ? userReferralRows.map((node: any) => (
                <tr key={`referral-${node.userId}`} className="referrals-data-row">
                  <td className="referrals-col-user referral-cell-strong">{node.displayName}</td>
                  <td className="referrals-col-wallet referrals-wallet-col referral-cell-wallet">{node.wallet}</td>
                  <td className="referrals-col-package">Pkg {node.packageLevel}</td>
                  <td className="referrals-col-joined">{node.joinedLabel}</td>
                  <td className={`referrals-col-income ${parseDisplayNumber(node.income) > 0 ? "referral-income-positive" : "referral-income-zero"}`}>${node.income}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-6 text-center text-gray-500">No direct referrals yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  </section>
  );
}
