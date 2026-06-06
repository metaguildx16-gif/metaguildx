import type { DashboardPageProps } from "./DashboardPageTypes";

export function RebirthPage(props: DashboardPageProps) {
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
    <p className="section-label">Rebirth</p>
    <div className="space-y-6">
      <article className="section-card premium-panel border border-gray-700 bg-gray-900/90 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
        <div className="section-card-header border-b border-gray-800">
          <h3 className="section-card-title text-yellow-400">Rebirth Status</h3>
        </div>
        <div className="section-card-body space-y-5">
          <div className="rebirth-status-banner">
            <div>
              <p className="rebirth-status-eyebrow">Rebirth Cycle Status</p>
              <h4 className="rebirth-status-title">
                {snapshot.rebirthCount > 0 ? "Rebirth Triggered" : "Rebirth Charging"}
              </h4>
              <p className="rebirth-status-copy">
                {snapshot.rebirthCount > 0
                  ? "Your next earning identity is active and ready to grow with its own tree and rewards."
                  : "Keep filling your Package 1 journey to unlock the next rebirth slot with a fresh earning identity."}
              </p>
            </div>
            <span className={`rebirth-status-pill ${snapshot.rebirthCount > 0 ? "is-success" : "is-waiting"}`}>
              {snapshot.rebirthCount > 0 ? "ACTIVE" : "IN PROGRESS"}
            </span>
          </div>

          <div className="rebirth-status-grid">
            <div className="rebirth-status-metric">
              <p className="rebirth-status-metric-label">Total Rebirths</p>
              <p className="rebirth-status-metric-value">{snapshot.rebirthCount}</p>
            </div>
            <div className="rebirth-status-metric">
              <p className="rebirth-status-metric-label">Current Status</p>
              <p className={`rebirth-status-metric-value ${snapshot.rebirthCount > 0 ? "is-success" : "is-waiting"}`}>
                {rebirthStatusLabel}
              </p>
            </div>
          </div>

          <div className="rebirth-progress-shell">
            <div className="rebirth-progress-meta">
              <div>
                <p className="text-sm font-semibold text-yellow-400">xSlot Progress</p>
                <p className="mt-1 text-sm text-gray-300">Current cycle progress toward the next rebirth trigger.</p>
              </div>
              <span className="rebirth-progress-pill">
                xSlot {rebirthProgressStep} / 5
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-950">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-500"
                style={{ width: `${rebirthProgressPercent}%` }}
              />
            </div>
            <div className="rebirth-context-badges">
              <span className="rebirth-context-badge">{`Current Package: ${snapshot.packageLevel ? `Pkg ${snapshot.packageLevel}` : "Pending"}`}</span>
              <span className="rebirth-context-badge">{`Current Box: ${snapshot.currentBoxId ?? 1}`}</span>
              <span className="rebirth-context-badge is-bright">{rebirthProgressLabel}</span>
            </div>
          </div>
        </div>
      </article>

      <article className="section-card premium-panel border border-gray-700 bg-gray-900/90 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
        <div className="section-card-header border-b border-gray-800">
          <h3 className="section-card-title text-yellow-400">My Rebirth IDs</h3>
        </div>
        <div className="section-card-body">
          {selectedRebirthId ? (
            <div className="rebirth-subdash rebirth-subdash-shell">
              <div className="rebirth-subdash-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <button
                    onClick={rebirthGoBack}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "8px 16px", borderRadius: "8px", border: "none",
                      background: "rgba(46,111,216,0.15)", color: "#7EB3FF",
                      cursor: "pointer", fontSize: "13px", fontWeight: 600
                    }}
                  >
                    ← Back
                  </button>
                  {/* Breadcrumb */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#8899BB" }}>
                    <span
                      style={{ cursor: "pointer", color: "#7EB3FF" }}
                      onClick={() => { setSelectedRebirthId(null); setRebirthNavStack([]); }}
                    >
                      Rebirth IDs
                    </span>
                    {rebirthNavStack.map((id: any, i: any) => (
                      <span key={id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>›</span>
                        <span
                          style={{ cursor: "pointer", color: "#7EB3FF" }}
                          onClick={() => {
                            const newStack = rebirthNavStack.slice(0, i);
                            setRebirthNavStack(newStack);
                            setSelectedRebirthId(id);
                          }}
                        >
                          #{id}
                        </span>
                      </span>
                    ))}
                    <span>›</span>
                    <span style={{ color: "#EEF4FF", fontWeight: 600 }}>#{selectedRebirthId}</span>
                  </div>
                </div>
                <div className="rebirth-subdash-headline">
                  <span className="rebirth-detail-badge">ACTIVE ID</span>
                  <h2 className="rebirth-subdash-title">{`Rebirth ID #${selectedRebirthId}`}</h2>
                </div>
              </div>

              <div className="rebirth-stats-row">
                {[
                  { label: "Package", value: selectedRebirthRow ? `Pkg ${selectedRebirthRow.packageLevel}` : "Pkg 1", icon: "📦" },
                  { label: "Direct Income", value: `$${rebirthNodeDetails?.directIncome ?? "0"}`, cyan: true, icon: "💰" },
                  { label: "Level Income", value: `$${rebirthNodeDetails?.levelIncome ?? "0"}`, cyan: true, icon: "📊" },
                  { label: "Total Team", value: String((rebirthNodeDetails?.leftBranchNodes ?? 0) + (rebirthNodeDetails?.rightBranchNodes ?? 0)), icon: "👥" },
                  { label: "Direct Referrals", value: String(rebirthNodeDetails?.directReferrals ?? 0), icon: "🤝" },
                  {
                    label: "Total Earnings",
                    value: `$${
                      rebirthNodeDetails
                        ? (
                            parseFloat(rebirthNodeDetails.directIncome ?? "0") +
                            parseFloat(rebirthNodeDetails.levelIncome ?? "0")
                          ).toFixed(2)
                        : "0"
                    }`,
                    gold: true,
                    icon: "🏆"
                  },
                  ...(rebirthNodeDetails && parseDisplayNumber(rebirthNodeDetails.mgxAllocated) > 0
                    ? [
                        {
                          label: "MGX Allocated",
                          value: `${rebirthNodeDetails.mgxAllocated} MGX`,
                          gold: true,
                          icon: "MGX"
                        }
                      ]
                    : [])
                ].map((stat, index) => (
                  <div key={`rebirth-stat-${index}`} className="rebirth-stat-card">
                    <span className="rebirth-stat-icon" aria-hidden="true">{stat.icon}</span>
                    <span className="rebirth-stat-label">{stat.label}</span>
                    <strong
                      className={`rebirth-stat-value ${
                        stat.cyan ? "text-cyan" : stat.gold ? "text-gold" : ""
                      }`}
                    >
                      {stat.value}
                    </strong>
                  </div>
                ))}
              </div>

              {/* Sub-rebirth IDs for this selected rebirth */}
              {(() => {
                const currentDetail = rebirthNodeDetails;
                const subRebirthIds = currentDetail?.rebirthIds ?? [];
                if (subRebirthIds.length === 0) return null;
                return (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{
                      fontSize: "13px", fontWeight: 600, color: "#C9A84C",
                      marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px"
                    }}>
                      ♻️ Rebirth IDs from #{selectedRebirthId}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {subRebirthIds.map((subId: number) => (
                        <button
                          key={subId}
                          onClick={() => navigateToRebirth(subId)}
                          style={{
                            padding: "8px 16px", borderRadius: "8px",
                            background: "rgba(201,168,76,0.1)",
                            border: "1px solid rgba(201,168,76,0.3)",
                            color: "#C9A84C", cursor: "pointer",
                            fontSize: "13px", fontWeight: 600,
                            display: "flex", alignItems: "center", gap: "6px"
                          }}
                        >
                          ♻️ ID #{subId}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="rebirth-subdash-tabs">
                {(["earnings", "tree", "referral"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRebirthDashView(tab)}
                    className={`rebirth-tab ${rebirthDashView === tab ? "active" : ""}`}
                  >
                    {tab === "referral" ? "Referral Link" : `${tab.charAt(0).toUpperCase()}${tab.slice(1)}`}
                  </button>
                ))}
              </div>

              <div className="rebirth-subdash-content">
                {rebirthDashView === "earnings" ? (
                  <>
                    <div className="rebirth-earnings-grid">
                      {[
                        { label: "Direct Income", value: rebirthNodeDetails?.directIncome ?? "0", money: true },
                        { label: "Level Income", value: rebirthNodeDetails?.levelIncome ?? "0", money: true },
                        { label: "Left Team", value: String(rebirthNodeDetails?.leftBranchNodes ?? 0) },
                        { label: "Right Team", value: String(rebirthNodeDetails?.rightBranchNodes ?? 0) }
                      ].map((item: any, index: any) => (
                        <div key={`rebirth-earnings-${index}`} className="rebirth-income-card">
                          <span>{item.label}</span>
                          <strong className={item.money ? "text-cyan" : ""}>
                            {item.money ? `$${item.value}` : item.value}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <div className="section-card mt-4">
                      <div className="section-card-header">
                        <h3 className="section-card-title">Auto-Upgrade Escrow</h3>
                      </div>
                      <div className="section-card-body">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-white">🔐 Auto-Upgrade Escrow</span>
                            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                              {`xSlot ${rebirthXSlotStep} / 5`}
                            </span>
                          </div>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600"
                              style={{ width: `${Math.min(rebirthEscrowProgress, 100)}%` }}
                            />
                          </div>
                          <div className="mt-2 text-right text-xs font-medium text-cyan-300">
                            {`${rebirthEscrowProgress.toFixed(1)}%`}
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                              <span className="block text-xs uppercase tracking-[0.18em] text-gray-400">Frozen</span>
                              <span className="mt-1 block text-sm font-semibold text-cyan-300">{`$${rebirthFrozenAmount.toFixed(2)}`}</span>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                              <span className="block text-xs uppercase tracking-[0.18em] text-gray-400">Needed</span>
                              <span className="mt-1 block text-sm font-semibold text-white">{`$${rebirthNeededAmount.toFixed(2)}`}</span>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                              <span className="block text-xs uppercase tracking-[0.18em] text-gray-400">Package</span>
                              <span className="mt-1 block text-sm font-semibold text-white">{`Pkg ${rebirthPkgLevel}`}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="section-card mt-4">
                      <div className="section-card-header">
                        <h3 className="section-card-title">Box Earnings</h3>
                      </div>
                      <div className="section-card-body">
                        {Object.keys(rebirthBoxEarningsByPkg).length > 0 ? (
                          <div className="space-y-3">
                            {Object.entries(rebirthBoxEarningsByPkg)
                              .sort((a, b) => Number(a[0]) - Number(b[0]))
                              .map(([pkg, amount]) => (
                                <div key={`rebirth-box-${pkg}`} className="income-row premium-income-row">
                                  <span className="income-label">{`Box 1 � Pkg ${pkg}`}</span>
                                  <span className="income-amount">{`$${Number(amount).toFixed(2)}`}</span>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="py-2 text-sm text-gray-500">No box earnings yet</div>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}

                {rebirthDashView === "tree" ? (
                  <Suspense
                    fallback={
                      <div className="text-center text-gray-400 py-8">
                        Loading tree...
                      </div>
                    }
                  >
                    <LazyTreePanel
                      key={`rebirth-tree-${selectedRebirthId}`}
                      snapshot={snapshot}
                      treePreview={rebirthTreePreview}
                      selectedTreeUserId={selectedRebirthId}
                      setSelectedTreeUserId={setSelectedRebirthId}
                      selectedTreeNode={
                        rebirthTreePreview.find((node: any) => node.userId === selectedRebirthId) ?? null
                      }
                      selectedTreePath={[]}
                      selectedTreeParent={null}
                      selectedTreeChildren={[]}
                      selectedTreeDetails={rebirthNodeDetails}
                      selectedFeaturedUser={null}
                      leftBranchNodes={[]}
                      rightBranchNodes={[]}
                      isLoadingTreeDetails={isLoadingRebirthDetails}
                      treeLabel="Rebirth Tree"
                      treeTitle={`Rebirth Tree: User ${selectedRebirthId}`}
                      treeDescription="Earns independently from original ID."
                      emptyStateText="No rebirth tree data."
                      initialRootId={selectedRebirthId}
                      disableRootSync={true}
                      showEventHistory={false}
                      userDisplayNames={userDisplayNames}
                    />
                  </Suspense>
                ) : null}

                {rebirthDashView === "referral" ? (
                  <div className="rebirth-referral-section">
                    <p className="text-secondary mb-3">
                      {`Share this link to add members under Rebirth ID #${selectedRebirthId}`}
                    </p>
                    <div className="referral-link-row">
                      <input
                        readOnly
                        className="referral-link-input"
                        value={
                          typeof window !== "undefined"
                            ? `${window.location.origin}/?ref=${selectedRebirthId ?? ""}`
                            : ""
                        }
                      />
                      <button
                        type="button"
                        className="btn-primary-large"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `${window.location.origin}/?ref=${selectedRebirthId ?? ""}`
                          )
                        }
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : rebirthRows.length > 0 ? (
            <div className="rebirth-id-grid">
              {rebirthRows.map((row: any) => {
                const rebirthReferralLink =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/?ref=${row.userId}`
                    : "Wallet unavailable";
                const isRebirthIncomeLoading = !rebirthIncomeByUserId[row.userId];

                return (
                  <article
                    key={`rebirth-${row.rebirthId}`}
                    className="rebirth-id-card premium"
                    style={{ cursor: "pointer" }}
                    onClick={() => { setRebirthNavStack([]); navigateToRebirth(Number(row.rebirthId)); }}
                  >
                    <div className="rebirth-id-card-top">
                      <div className="rebirth-id-copy">
                        <div className="rebirth-id-header">
                          <span className="rebirth-id-badge">{`Rebirth ID #${row.rebirthId}`}</span>
                          <span className="rebirth-package-chip">{row.packageLabel}</span>
                        </div>
                        <p className="rebirth-id-wallet" title={row.wallet}>
                          {row.wallet === "Same wallet" ? row.wallet : `${row.wallet.slice(0, 6)}...${row.wallet.slice(-4)}`}
                        </p>
                      </div>
                      <span className="rebirth-live-pill">
                        {row.status}
                      </span>
                    </div>

                    <div className="rebirth-id-body">
                      <div className="rebirth-income-stack">
                        <span className="rebirth-income-label">Total Earned</span>
                        <p className="rebirth-income-value">
                          {isRebirthIncomeLoading ? (
                            <span className="text-gray-500">Loading...</span>
                          ) : (
                            <>
                              <span className="rebirth-currency">$</span>
                              {(
                                parseFloat(row.directIncome ?? "0") +
                                parseFloat(row.levelIncome ?? "0")
                              ).toFixed(2)}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="rebirth-link-shell">
                        <p className="rebirth-link-label">Referral Link</p>
                        <div className="rebirth-link-row">
                          <input
                            className="referral-link-input flex-1"
                            value={rebirthReferralLink}
                            readOnly
                            aria-label={`Rebirth referral link for user ${row.rebirthId}`}
                            title={rebirthReferralLink}
                          />
                          <button
                            type="button"
                            className="rebirth-link-copy-btn"
                            onClick={() =>
                              void handleCopyRebirthReferralLink(String(row.userId))
                            }
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rebirth-id-actions">
                      <button
                        type="button"
                        className="rebirth-id-view-btn"
                        onClick={() => {
                          setRebirthNavStack([]);
                          navigateToRebirth(Number(row.rebirthId));
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/40 px-6 py-10 text-center">
              <p className="text-lg font-semibold text-yellow-400">No rebirth IDs yet</p>
              <p className="mt-2 text-sm text-gray-300">Complete the Package 1 five-cycle journey to unlock your next rebirth.</p>
            </div>
          )}
        </div>
      </article>

      <article className="section-card border border-gray-700 bg-gray-900/90 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
        <div className="section-card-header border-b border-gray-800">
          <h3 className="section-card-title text-yellow-400">How Rebirth Works</h3>
        </div>
        <div className="section-card-body">
          <ul className="space-y-3 text-sm text-gray-200">
            <li><span className="text-cyan-400">�</span> Rebirth triggers after completing the Package 1 five-cycle journey.</li>
            <li><span className="text-cyan-400">�</span> Your rebirth ID uses the same wallet but starts fresh as a new earning identity.</li>
            <li><span className="text-cyan-400">�</span> Original and rebirth IDs continue earning independently inside the same ecosystem.</li>
            <li><span className="text-cyan-400">�</span> Use the tree viewer above to inspect each rebirth ID�s placement and live income progress.</li>
          </ul>
        </div>
      </article>
    </div>
  </section>
  );
}
