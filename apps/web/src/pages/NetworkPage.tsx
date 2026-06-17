import type { DashboardPageProps } from "./DashboardPageTypes";

export function NetworkPage(props: DashboardPageProps) {
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
    <p className="section-label">Network</p>
    <div className="summary-strip referrals-summary-strip premium-network-stats w-full max-w-full" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
      <article className="summary-chip premium-network-card" style={{minWidth:0,overflow:"hidden"}}>
        <span style={{fontSize:".68rem",color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Direct Referrals</span>
        <strong style={{fontFamily:"Syne,sans-serif",fontSize:"1.2rem",fontWeight:700,color:"var(--text-primary)",display:"block"}}>{snapshot.directReferrals}</strong>
      </article>
      <article className="summary-chip premium-network-card" style={{minWidth:0,overflow:"hidden"}}>
        <span style={{fontSize:".68rem",color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Total Team</span>
        <strong style={{fontFamily:"Syne,sans-serif",fontSize:"1.2rem",fontWeight:700,color:"var(--text-primary)",display:"block"}}>{totalTeamMembers}</strong>
      </article>
      <article className="summary-chip premium-network-card" style={{minWidth:0,overflow:"hidden"}}>
        <span style={{fontSize:".68rem",color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Left | Right</span>
        <strong style={{fontFamily:"Syne,sans-serif",fontSize:"1.1rem",fontWeight:700,color:"var(--text-primary)",display:"block"}}>{snapshot.leftBranchNodes || "—"} | {snapshot.rightBranchNodes || "—"}</strong>
      </article>
      <article className="summary-chip premium-network-card team-business">
        <span>📊 Team Business</span>
        <strong>${teamBusinessDisplay}</strong>
      </article>
    </div>

    <div className="dashboard-subtabs-shell">
      <div className="dashboard-subtabs">
        {([
          ["referrals", "Referrals"],
          ["tree", "Tree"],
          ["incomelog", "Income Log"]
        ] as const).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            className={`dashboard-subtab ${networkDashTab === tabId ? "active" : ""}`}
            onClick={() => setNetworkDashTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`dashboard-subtab-content ${networkDashTab === "tree" ? "is-tree" : ""}`}>
        {networkDashTab === "referrals" ? (
          <div className="referrals-layout">
            <article className="section-card referral-card-link premium-panel">
              <div className="section-card-header">
                <h3 className="section-card-title">Share Your Link</h3>
              </div>
              <div className="section-card-body premium-share-card">
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
                  <button
                    type="button"
                    className="referral-share-btn share-wa"
                    onClick={() => handleShareReferralLink("whatsapp")}
                    disabled={!referralLink}
                    aria-label="Share on WhatsApp"
                  >
                    WA
                  </button>
                  <button
                    type="button"
                    className="referral-share-btn share-tg"
                    onClick={() => handleShareReferralLink("telegram")}
                    disabled={!referralLink}
                    aria-label="Share on Telegram"
                  >
                    TG
                  </button>
                  <button
                    type="button"
                    className="referral-share-btn share-x"
                    onClick={() => handleShareReferralLink("twitter")}
                    disabled={!referralLink}
                    aria-label="Share on X"
                  >
                    X
                  </button>
                </div>
                {referralCopyStatus ? <p className="copy-status-text">{referralCopyStatus}</p> : null}
              </div>
            </article>

            <article className="section-card premium-panel">
              <div className="section-card-header">
                <h3 className="section-card-title">Direct Referrals</h3>
              </div>
              <div className="section-card-body overflow-x-auto">
                <table className="referrals-table min-w-full divide-y divide-gray-800 text-left text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="referrals-col-user">#</th>
                      <th className="referrals-col-user">User</th>
                      <th className="referrals-col-package">Package</th>
                      <th className="referrals-col-joined">Joined</th>
                      <th className="referrals-col-income">Income</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/70">
                    {userReferralRows.length > 0 ? userReferralRows.map((node: any, index: any) => (
                      <tr key={`network-referral-${node.userId}`} className="referrals-data-row">
                        <td className="referrals-col-user">{index + 1}</td>
                        <td className="referrals-col-user referral-cell-strong"><span className="referral-user-pill">{node.displayName}</span></td>
                        <td className="referrals-col-package"><span className="referral-pkg-pill">{`Pkg ${node.packageLevel}`}</span></td>
                        <td className="referrals-col-joined"><span className="referral-joined-muted">{node.joinedLabel}</span></td>
                        <td className={`referrals-col-income ${parseDisplayNumber(node.income) > 0 ? "referral-income-positive" : "referral-income-zero"}`}>${parseDisplayNumber(node.income).toFixed(2)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-6 text-center text-gray-500">No direct referrals yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        ) : null}

        {networkDashTab === "tree" ? (
          <div className="network-tree-shell">
            <div className="dashboard-tree-mode-bar">
              <button
                type="button"
                onClick={() => setTreeMode("personal")}
                className={`dashboard-subtab ${treeMode === "personal" ? "active" : ""}`}
              >
                Personal Tree
              </button>
              <button
                type="button"
                onClick={() => setTreeMode("level")}
                className={`dashboard-subtab ${treeMode === "level" ? "active" : ""}`}
              >
                Level Tree
              </button>
            </div>
            <Suspense fallback={<section className="panel"><p>Loading tree view...</p></section>}>
              <div className="dashboard-tree-scroll">
                {treeMode === "level" && (snapshot.directReferrals ?? 0) === 0 ? (
                  <div className="section-card-body empty-state">
                    <p>No referrals yet. Invite someone to see your Level Tree.</p>
                  </div>
                ) : (
                  <LazyTreePanel
                    snapshot={snapshot}
                    treePreview={activeTreePreview}
                    treeLevels={treeLevels}
                    selectedTreeUserId={selectedTreeUserId}
                    setSelectedTreeUserId={setSelectedTreeUserId}
                    selectedTreeNode={selectedTreeNode}
                    selectedTreePath={selectedTreePath}
                    selectedTreeParent={selectedTreeParent}
                    selectedTreeChildren={selectedTreeChildren}
                    selectedTreeDetails={treeMode === "personal" ? selectedTreeDetails : null}
                    selectedFeaturedUser={selectedFeaturedUser}
                    leftBranchNodes={leftBranchNodes}
                    rightBranchNodes={rightBranchNodes}
                    isLoadingTreeDetails={treeMode === "personal" ? isLoadingTreeDetails : isLoadingLevelTree}
                    treeLabel={treeMode === "personal" ? "Tree" : "Level Tree"}
                    treeTitle={treeMode === "personal" ? "Binary Tree View" : "Level Tree View"}
                    treeDescription={
                      treeMode === "personal"
                        ? "Root stays centered. Left and right child slots stay visible for at least three levels."
                        : "Eligible users are shown in the same pyramid layout. Open slots stay visible for at least three levels."
                    }
                    emptyStateText={treeMode === "personal" ? "No tree nodes loaded yet." : "No level tree available."}
                    showEventHistory={false}
                    userDisplayNames={userDisplayNames}
                  />
                )}
              </div>
            </Suspense>
          </div>
        ) : null}

        {networkDashTab === "incomelog" ? (
          <article className="section-card premium-panel">
            <div className="section-card-header">
              <h3 className="section-card-title">Income Log</h3>
            </div>
            <div className="section-card-body">
              <ul className="metric-list compact progress-list">
                {networkBonusHistoryRows.length > 0 ? networkBonusHistoryRows.map((item: any) => (
                  <li key={`network-log-${item.txHash}`}>
                    <strong>{item.fromUserId ? `From User #${(()=>{const c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";let n=item.fromUserId+100000,e="";while(n>0){e=c[n%62]+e;n=Math.floor(n/62);}return e;})()}` : "Rebirth network"}</strong> � {item.dateLabel}<br />
                    <span className="text-secondary">{`Amount: $${item.amount}`}</span>
                  </li>
                )) : <li>No network income log yet.</li>}
              </ul>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  </section>
  );
}
