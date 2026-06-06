import type { DashboardPageProps } from "./DashboardPageTypes";

export function CashbackPage(props: DashboardPageProps) {
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
    <p className="section-label">Cashback</p>
    <div className="summary-strip flex flex-wrap gap-2 w-full max-w-full">
      <article className="summary-chip">
        <span>Surrender Status</span>
        <strong>{snapshot.surrenderStatus}</strong>
      </article>
      <article className="summary-chip">
        <span>Pending Cashback</span>
        <strong>${snapshot.pendingCashback}</strong>
      </article>
      <article className="summary-chip">
        <span>Cashback Earned</span>
        <strong>${snapshot.cashbackIncome}</strong>
      </article>
      <article className="summary-chip">
        <span>Auto Settlement</span>
        <strong>{snapshot.pendingCashback !== "0" ? "Ready" : "Waiting"}</strong>
      </article>
    </div>

    <div className="dashboard-grid detailed grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-full">
      <article className="dashboard-card action-card">
        <h3>Surrender</h3>
        <div className="info-card">
          <strong>Pool Status</strong>
          <span>Pool Balance: ${snapshot.cashbackPoolBalance}</span>
          <span>Your Share: ${snapshot.pendingCashback}</span>
          <span>Status: {snapshot.surrenderStatus}</span>
          <span>Cashback is reserved for surrendered IDs after the full cycle.</span>
        </div>
        <button
          type="button"
          title="Available after mainnet launch"
          disabled
        >
          Surrender
        </button>
      </article>

      <article className="dashboard-card action-card">
        <h3>Claim Cashback</h3>
        <ul className="metric-list">
          <li>Pending cashback: ${snapshot.pendingCashback}</li>
          <li>Claim status: Available after mainnet launch</li>
          <li>Escrow balance: ${escrowBalance}</li>
          <li>Connected wallet value: ${snapshot.connectedWalletValue}</li>
        </ul>
        <button
          type="button"
          title="Available after mainnet launch"
          disabled
        >
          Claim Cashback
        </button>
      </article>

      <article className="dashboard-card action-card">
        <h3>Cashback Notes</h3>
        <ul className="metric-list">
          <li>Pool Balance: ${snapshot.cashbackPoolBalance}</li>
          <li>Surrender Status: {snapshot.surrenderStatus}</li>
          <li>Surrender window follows 3 to 6 month rules.</li>
          <li>Claim and surrender buttons are disabled until mainnet launch.</li>
        </ul>
      </article>
    </div>
  </section>
  );
}
