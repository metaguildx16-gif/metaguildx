import type { DashboardPageProps } from "./DashboardPageTypes";

export function RegisterPage(props: DashboardPageProps) {
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
    <p className="section-label">Register</p>
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: "16px",
      width: "100%"
    }}>
      <div className="dashboard-card" style={{ padding: "24px", borderRadius: "16px" }}>
        <h3 style={{
          fontSize: "15px", fontWeight: 700, color: "#C9A84C",
          marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px"
        }}>
          👤 Sponsor Details
        </h3>
        <p style={{ fontSize: "13px", color: "#8899BB", marginBottom: "20px" }}>
          Enter your sponsor's ID to join their network
        </p>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13px", color: "#8899BB", marginBottom: "6px" }}>
            Sponsor ID
          </label>
          {referralSponsorId !== null ? (
            <div style={{
              padding: "12px 16px", borderRadius: "10px",
              background: "rgba(201,168,76,0.08)",
              border: "1px solid rgba(201,168,76,0.25)",
              display: "flex", alignItems: "center", gap: "10px"
            }}>
              <span style={{ fontSize: "20px" }}>🔒</span>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#C9A84C" }}>
                  Sponsor #{referralSponsorId} Locked
                </div>
                <div style={{ fontSize: "12px", color: "#8899BB" }}>
                  You were invited by this sponsor
                </div>
              </div>
            </div>
          ) : (
            <input
              type="number"
              value={registerForm.sponsorId}
              onChange={(event) => setRegisterForm((current: any) => ({ ...current, sponsorId: event.target.value }))}
              placeholder="Enter Sponsor ID"
              min="1"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: "10px",
                background: "rgba(46,111,216,0.08)",
                border: "1px solid rgba(46,111,216,0.25)",
                color: "#EEF4FF", fontSize: "14px", outline: "none",
                boxSizing: "border-box", fontFamily: "inherit"
              }}
            />
          )}
        </div>
        {referralSponsorId !== null && referralSponsorProfile ? (
          <div style={{
            padding: "12px 16px", borderRadius: "10px",
            background: "rgba(46,111,216,0.06)",
            border: "1px solid rgba(46,111,216,0.2)",
            display: "flex", alignItems: "center", gap: "12px"
          }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "50%",
              background: "linear-gradient(135deg,rgba(201,168,76,.3),rgba(46,111,216,.2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, color: "#C9A84C", fontSize: "14px", flexShrink: 0
            }}>
              #{referralSponsorId}
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#EEF4FF" }}>
                User #{referralSponsorId}
              </div>
              <div style={{ fontSize: "11px", color: "#8899BB" }}>
                {referralSponsorProfile.directReferrals} partners · Pkg {referralSponsorProfile.packageLevel}
              </div>
              <div style={{
                marginTop: "4px", display: "inline-flex", alignItems: "center",
                gap: "4px", padding: "2px 8px",
                background: "rgba(46,196,143,.1)", border: "1px solid rgba(46,196,143,.2)",
                borderRadius: "4px", fontSize: "11px", color: "#2EC48F"
              }}>
                ✓ Verified
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="dashboard-card" style={{ padding: "24px", borderRadius: "16px" }}>
        <h3 style={{
          fontSize: "15px", fontWeight: 700, color: "#C9A84C",
          marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px"
        }}>
          📦 Package Activation
        </h3>
        <p style={{ fontSize: "13px", color: "#8899BB", marginBottom: "20px" }}>
          Start with Package 1 — upgrade anytime
        </p>
        <div style={{
          padding: "16px", borderRadius: "12px", marginBottom: "16px",
          background: "linear-gradient(135deg,rgba(201,168,76,.1),rgba(46,111,216,.06))",
          border: "1px solid rgba(201,168,76,.25)",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "13px", color: "#8899BB", marginBottom: "4px" }}>Package Level</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: "#C9A84C", fontFamily: "Syne,sans-serif" }}>
              Package 1
            </div>
            <div style={{ fontSize: "12px", color: "#7EB3FF", marginTop: "2px" }}>
              Entry level · All features
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "13px", color: "#8899BB", marginBottom: "4px" }}>Amount</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#EEF4FF", fontFamily: "Syne,sans-serif" }}>
              ${snapshot.packagePrices[0] ?? 10}
            </div>
            <div style={{ fontSize: "12px", color: "#8899BB" }}>USDT</div>
          </div>
        </div>
        <div style={{ marginBottom: "20px" }}>
          {[
            { label: "Direct income", value: "$4.60", color: "#C9A84C" },
            { label: "Level income", value: "$4.00", color: "#2EC48F" },
            { label: "Cashback pool", value: "$0.40", color: "#7EB3FF" },
            { label: "Royalty pool", value: "$1.00", color: "#8899BB" },
          ].map((row, index) => (
            <div key={row.label} style={{
              display: "flex", justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: index < 3 ? "1px solid rgba(46,111,216,0.08)" : "none"
            }}>
              <span style={{ fontSize: "13px", color: "#8899BB" }}>{row.label}</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>
        {!registrationSummary ? (
          <button
            className="btn-primary"
            style={{
              width: "100%", padding: "14px",
              borderRadius: "12px", fontSize: "15px",
              fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1
            }}
            onClick={() => setShowActivationConfirm(true)}
            disabled={isLoading || !snapshot.walletAddress}
          >
            {isLoading ? "⏳ Processing..." : "⚡ Activate Package 1 — $10 USDT"}
          </button>
        ) : (
          <div style={{
            padding: "14px", borderRadius: "12px", textAlign: "center",
            background: "rgba(46,196,143,0.1)", border: "1px solid rgba(46,196,143,0.3)",
            color: "#2EC48F", fontWeight: 700, fontSize: "15px"
          }}>
            ✅ Registration Complete!
          </div>
        )}
      </div>

      <div className="dashboard-card" style={{ padding: "24px", borderRadius: "16px" }}>
        <h3 style={{
          fontSize: "15px", fontWeight: 700, color: "#C9A84C",
          marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px"
        }}>
          📋 How it works
        </h3>
        <p style={{ fontSize: "13px", color: "#8899BB", marginBottom: "20px" }}>
          Registration steps & rules
        </p>
        {isLoading && regStep > 0 ? (
          <div style={{ marginBottom: "20px" }}>
            {[
              { step: 1, label: "Approve USDT", icon: "✅" },
              { step: 2, label: "Confirm Registration", icon: "🔐" },
              { step: 3, label: "On-chain Processing", icon: "⛓️" },
              { step: 4, label: "Complete", icon: "🎉" },
            ].map(({ step, label, icon }) => (
              <div key={step} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "10px 0",
                borderBottom: step < 4 ? "1px solid rgba(46,111,216,0.08)" : "none",
                opacity: regStep >= step ? 1 : 0.4
              }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                  background: regStep >= step ? "rgba(46,196,143,0.15)" : "rgba(46,111,216,0.08)",
                  border: regStep >= step ? "1px solid rgba(46,196,143,0.4)" : "1px solid rgba(46,111,216,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px"
                }}>
                  {regStep >= step ? icon : step}
                </div>
                <span style={{
                  fontSize: "13px",
                  color: regStep >= step ? "#EEF4FF" : "#8899BB",
                  fontWeight: regStep >= step ? 600 : 400
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginBottom: "20px" }}>
            {[
              { icon: "🔗", text: "Connect MetaMask wallet" },
              { icon: "💵", text: "Have $10 USDT on opBNB network" },
              { icon: "✍️", text: "Approve USDT transaction" },
              { icon: "⛓️", text: "Confirm registration on-chain" },
              { icon: "🎉", text: "Welcome to MetaGuildX!" },
            ].map((item: any, index: any) => (
              <div key={item.text} style={{
                display: "flex", alignItems: "flex-start", gap: "12px",
                padding: "10px 0",
                borderBottom: index < 4 ? "1px solid rgba(46,111,216,0.08)" : "none"
              }}>
                <span style={{ fontSize: "18px", flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: "13px", color: "#8899BB", lineHeight: 1.5 }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        )}
        {registrationSummary ? (
          <div style={{
            padding: "16px", borderRadius: "12px",
            background: "rgba(46,196,143,0.06)",
            border: "1px solid rgba(46,196,143,0.2)"
          }}>
            <div style={{ fontSize: "13px", color: "#2EC48F", fontWeight: 700, marginBottom: "8px" }}>
              🎉 Registration Complete
            </div>
            <div style={{ fontSize: "12px", color: "#8899BB" }}>
              Tx: {registrationSummary.txHash?.slice(0, 10)}...
            </div>
            <div style={{ fontSize: "12px", color: "#8899BB", marginTop: "4px" }}>
              Paid: {registrationSummary.paid}
            </div>
            <button
              className="btn-primary"
              style={{ width: "100%", marginTop: "12px", padding: "10px", borderRadius: "10px" }}
              onClick={() => setDashboardView("overview")}
            >
              Go to Dashboard →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  </section>
  );
}
