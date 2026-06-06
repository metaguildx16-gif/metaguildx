import type { DashboardPageProps } from "./DashboardPageTypes";

export function IncomePage(props: DashboardPageProps) {
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
    <p className="section-label">Earnings</p>
    <div className="stats-grid premium-earnings-strip">
      <article className="stat-card premium-earnings-stat"><p className="stat-card-label">Direct Income</p><p className="stat-card-value">${directIncomeDisplay}</p></article>
      <article className="stat-card premium-earnings-stat"><p className="stat-card-label">Level Income</p><p className="stat-card-value">${levelIncomeDisplay}</p></article>
      <article className="stat-card premium-earnings-stat" title="Display only — Network activity"><p className="stat-card-label">Crossline Income</p><p className="stat-card-value">${networkBonusDisplay}</p></article>
      <article className="stat-card premium-earnings-total"><p className="stat-card-label">Total Earned</p><p className="stat-card-value">${totalReceivedDisplay}</p></article>
    </div>

    <div className="dashboard-subtabs-shell">
      <div className="dashboard-subtabs">
        {([
          ["overview", "Overview"],
          ["levels", "Levels"],
          ["boxcross", "Box & Cross"],
          ["activity", "Activity"]
        ] as const).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            className={`dashboard-subtab ${earningsDashTab === tabId ? "active" : ""}`}
            onClick={() => setEarningsDashTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="dashboard-subtab-content">
        {earningsDashTab === "overview" ? (
          <article className="section-card premium-panel">
            <div className="section-card-header">
              <h3 className="section-card-title">My Earnings</h3>
              <button type="button" className="btn-refresh-reward" onClick={() => void handleRefreshSection("Earnings")} disabled={isLoading}>
                ? Refresh
              </button>
            </div>
            <div className="section-card-body">
              {showDashboardSkeleton ? (
                renderSkeletonRows(6)
              ) : (
                <>
                  <div className="income-row premium-income-row"><span className="income-label">Direct Income</span><span className="income-amount">${directIncomeDisplay}</span></div>
                  <div className="income-row premium-income-row"><span className="income-label">Level Income</span><span className="income-amount">${levelIncomeDisplay}</span></div>
                  <div className="income-row premium-income-row total"><span className="income-label">Total Earned</span><span className="income-amount">${totalReceivedDisplay}</span></div>
                  <div className="income-row premium-income-row muted"><span className="income-label">Frozen (Auto-Upgrade)</span><span className="income-amount">${frozenEscrowDisplay}</span></div>
                  <div className="income-row income-row-secondary" title="Display only � Network activity">
                    <span className="income-label">Crossline (Display)</span>
                    <span className="income-amount">${networkBonusDisplay}</span>
                  </div>
                  <div className="income-row premium-income-row amber">
                    <span className="income-label">Spillover (Display)</span>
                    <span className="income-amount">${spilloverIncomeDisplay}</span>
                  </div>
                  <p className="premium-income-note">Network activity record only.</p>
                </>
              )}
            </div>
          </article>
        ) : null}

        {earningsDashTab === "levels" ? (
          <article className="section-card premium-panel">
            <div className="section-card-header">
              <h3 className="section-card-title">Level Income Breakdown</h3>
            </div>
            <div className="section-card-body">
              <div className="levels-summary-card premium-levels-summary">
                <div className="levels-summary-line">
                  <span>Active Levels:</span>
                  <strong className="premium-level-pill">{activeLevelsCount} / 10</strong>
                </div>
                <div className="levels-summary-line">
                  <span>Direct Referrals:</span>
                  <strong>{snapshot.directReferrals}</strong>
                </div>
                <div className="levels-summary-line">
                  <span>Unlock Rule:</span>
                  <strong>{referralGoalLabel}</strong>
                </div>
              </div>
              <div className="levels-status-grid compact-level-grid mt-4">
                {visibleLevelBreakdownRows.map((row: any) => {
                  const levelSummary = userLevelSummaryRows.find((candidate: any) => candidate.levelNumber === row.level);
                  const isUnlocked = levelSummary?.isUnlocked ?? false;
                  const hasIncome = parseDisplayNumber(row.amount) > 0;
                  return (
                    <article
                      key={`income-level-${row.level}`}
                      className={`level-status-card ${!isUnlocked ? "level-status-card-locked" : hasIncome ? "level-status-card-active" : "level-status-card-info"}`}
                    >
                      <strong>{`L${row.level}`}</strong>
                      <span className={`level-status-badge ${isUnlocked ? (hasIncome ? "active" : "info") : "locked"}`}>
                        {!isUnlocked ? "Locked" : hasIncome ? "Active" : "Ready"}
                      </span>
                      <span className="level-status-members">{row.members} {row.members === 1 ? "member" : "members"}</span>
                      <span className="level-status-rate">${parseDisplayNumber(row.amount).toFixed(2)}</span>
                    </article>
                  );
                })}
              </div>
            </div>
          </article>
        ) : null}

        {earningsDashTab === "boxcross" ? (
          <div className="income-layout">
            <article className="section-card premium-panel">
              <div className="section-card-header">
                <h3 className="section-card-title text-yellow-400">Box Earnings</h3>
              </div>
              <div className="section-card-body space-y-2">
                <p className="text-xs text-gray-400">Income by package cycle</p>
                {Object.entries(boxEarningsDisplay).map(([slot, amount]) => (
                  <div
                    key={`box-earnings-${slot}`}
                    className="box-earnings-row"
                  >
                    <div className="box-earnings-left">
                      <span className="box-earnings-badge">
                        {slot}
                      </span>
                      <span className="text-sm text-gray-300">{`Box ${slot}`}</span>
                      <span className="box-earnings-pkg">{`Pkg ${slot}`}</span>
                    </div>
                    <strong className="font-semibold text-cyan-400">{`$${amount}`}</strong>
                  </div>
                ))}
                {Object.keys(boxEarningsDisplay).length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-500">No box earnings yet</div>
                ) : null}
              </div>
            </article>

            <article className="section-card premium-panel">
              <div className="section-card-header">
                <h3 className="section-card-title" title="Display only � Network activity">Crossline Income</h3>
              </div>
              <div className="section-card-body">
                <p className="text-secondary">Display only � Network activity.</p>
                <ul className="metric-list compact progress-list mt-4">
                  {networkBonusHistoryRows.length > 0 ? networkBonusHistoryRows.map((item: any) => (
                    <li key={`crossline-${item.txHash}`}>
                      <strong>{item.fromUserId ? `From User #${item.fromUserId} (rebirth network)` : "Rebirth network"}</strong> � {item.dateLabel}<br />
                      <span className="text-secondary">{`Amount: $${item.amount}`}</span>
                    </li>
                  )) : <li>No crossline income yet.</li>}
                </ul>
              </div>
            </article>
          </div>
        ) : null}

        {earningsDashTab === "activity" ? (
          <article className="section-card premium-panel">
            <div className="section-card-header">
              <h3 className="section-card-title">Recent Activity</h3>
            </div>
            <div className="section-card-body">
              <ul className="metric-list compact progress-list">
                {recentActivityRows.length > 0 ? recentActivityRows.slice(0, 5).map((item: any, index: any) => (
                  <li key={`recent-income-${item.blockNumber ?? "na"}-${item.primary}-${item.secondary}-${index}`}>
                    <strong>{item.primary}</strong> · {item.timestampLabel ?? "Live"}<br />
                    <span className="text-secondary">{item.secondary}</span>
                  </li>
                )) : <li>No activity yet.</li>}
              </ul>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  </section>
  );
}
