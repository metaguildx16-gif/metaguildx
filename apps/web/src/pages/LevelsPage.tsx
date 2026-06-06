import type { DashboardPageProps } from "./DashboardPageTypes";

export function LevelsPage(props: DashboardPageProps) {
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
    <p className="section-label">Level Summary</p>
    <div className="levels-layout">
      <article className="section-card levels-card-main">
        <div className="section-card-header">
          <h3 className="section-card-title">Unlock Summary</h3>
        </div>
        <div className="section-card-body">
          <div className="levels-summary-card">
            <div className="levels-summary-line">
              <span>Active Levels:</span>
              <strong>{activeLevelsCount} / 10</strong>
            </div>
            <div className="levels-summary-line">
              <span>Direct Referrals:</span>
              <strong>{snapshot.directReferrals}</strong>
            </div>
            <div className="levels-summary-line">
              <span>Next unlock at:</span>
              <strong>{nextUnlockReferralTarget ? `${nextUnlockReferralTarget} referrals` : "All levels unlocked"}</strong>
            </div>
          </div>
        </div>
      </article>

      <article className="section-card levels-card-main">
        <div className="section-card-header">
          <h3 className="section-card-title">Level Status Grid</h3>
        </div>
        <div className="section-card-body">
          <div className="levels-status-grid">
            {userLevelSummaryRows.map((row: any) => (
              <article
                key={`level-summary-${row.levelNumber}`}
                className={`level-status-card ${row.isUnlocked ? "level-status-card-active" : "level-status-card-locked"}`}
              >
                <strong>{`Level ${row.levelNumber}`}</strong>
                <span className={`level-status-badge ${row.isUnlocked ? "active" : "locked"}`}>
                  {row.isUnlocked ? "✅ Active" : "🔒 Locked"}
                </span>
                <span className="level-status-rate">4%</span>
              </article>
            ))}
          </div>
        </div>
      </article>

      <article className="section-card levels-card-side">
        <div className="section-card-header">
          <h3 className="section-card-title">Unlock Rules</h3>
        </div>
        <div className="section-card-body">
          <ul className="metric-list">
            <li>1 referral = 2 levels unlocked</li>
            <li>5 referrals = all 10 levels unlocked</li>
          </ul>
        </div>
      </article>
    </div>
  </section>
  );
}
