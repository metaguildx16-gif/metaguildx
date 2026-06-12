import type { DashboardPageProps } from "./DashboardPageTypes";

export function WalletPage(props: DashboardPageProps) {
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
    <p className="section-label">Wallet</p>
                  {walletSubView === "transfer" ? (
      <div className="transfer-container">
        <div className="transfer-header">
          <button type="button" className="btn-back" onClick={() => setWalletSubView("main")}>
            &larr; Back
          </button>
          <h3>Transfer</h3>
        </div>

        <div className="transfer-section">
          <label className="transfer-label">FROM</label>
          <div className="transfer-source">
            <div className="source-icon">MGX</div>
            <div className="source-info">
              <span className="source-name">{transferFromLabel}</span>
              <span className="source-balance">Balance: {transferFromBalance} MGX</span>
            </div>
          </div>
        </div>

        <div className="transfer-arrow">→</div>

        <div className="transfer-section">
          <label className="transfer-label">TO</label>
          <div className="transfer-destination">
            <div className="dest-icon">WAL</div>
            <div className="dest-info">
              <span className="dest-name">{transferToLabel}</span>
              <span className="dest-address">{shortWalletAddress}</span>
            </div>
          </div>
        </div>

        <div className="transfer-section">
          <label className="transfer-label">AMOUNT</label>
          <div className="amount-input-row">
            <input
              type="number"
              className="amount-input"
              placeholder="0"
              value={walletMoveAmount}
              onChange={(event) => setWalletMoveAmount(event.target.value)}
              inputMode="decimal"
            />
            <button
              type="button"
              className="btn-max"
              onClick={() => setWalletMoveAmount(displayedMgxAllocated)}
            >MAX</button>
          </div>
          <span className="transfer-token-label">MGX</span>
          <span className="source-balance">Balance: {displayedMgxAllocated} MGX</span>
        </div>

          <button
            type="button"
            className="btn-transfer-submit"
            disabled={
              isLoading ||
              !snapshot.walletAddress ||
              !snapshot.userId ||
              Number(walletMoveAmount) <= 0
            }
            onClick={() => {
              setStatus("Withdraw is not available in this deployment yet.");
              setActionFeedback({
                title: "Withdraw action is not live yet",
                detail: "This UI is ready, but the current deployment does not expose a public internal-wallet withdraw function."
              });
            }}
          >
            Transfer Now
          </button>
      </div>
    ) : walletSubView === "mgxboxes" ? (
      <div className="wallet-screen">
        <div className="wallet-screen-header">
          <button type="button" className="secondary-button" onClick={() => setWalletSubView("main")}>
            &larr; Back
          </button>
          <h2>MGX Allocation</h2>
        </div>

        <div className="wallet-total-balance mgx-allocation-hero">
          <div className="balance-label">Total Balance</div>
          <div className="mgx-allocation-hero-ring">
            <div className="balance-amount-large">{totalMgxAllocatedDisplay} MGX</div>
            <div className="balance-usd">{`� $${totalMgxAllocatedDisplay}`}</div>
          </div>
        </div>

        <div className="inner-balance-section mgx-allocation-grid">
          <div className="inner-balance-header">Inner Balance</div>
          {mgxAllocationRows.map((row: any) => (
            <div className="balance-row-item mgx-allocation-card" key={row.id}>
              <div className="token-icon-circle mgx">
                MGX
                <span className="box-number">{row.id}</span>
              </div>
              <div className="token-info">
                <span className="token-name">{`Box ${row.id}`}</span>
                <span className="token-sub">Available for withdrawal</span>
                <span className="mgx-allocation-status">Available</span>
              </div>
              <div className="token-amount-right">
                <span className="amount-main">{row.amount} MGX</span>
                <span className="amount-sub">{`� $${row.usdApprox}`}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="wallet-screen-button-stack">
          <button
            type="button"
            className="wallet-action-btn-full mgx-withdraw-btn"
            disabled={parseDisplayNumber(displayedMgxAllocated) <= 0}
            onClick={() => {
              setStatus("Withdraw is not available in this deployment yet.");
              setActionFeedback({
                title: "Withdraw action is not live yet",
                detail: "This UI is ready, but the current deployment does not expose a public internal-wallet withdraw function."
              });
            }}
          >
            Withdraw All MGX
          </button>
        </div>
      </div>
    ) : walletSubView === "stakingclaim" ? (
      <div className="wallet-screen">
        <div className="wallet-screen-header">
          <button type="button" className="secondary-button" onClick={() => setWalletSubView('main')}>&larr; Back</button>
          <h2>Staking Rewards</h2>
        </div>
        <div style={{textAlign:'center', padding:'48px 16px'}}>
          <div style={{fontSize:'2.5rem', marginBottom:'12px'}}>🔒</div>
          <h3 style={{color:'#a78bfa', marginBottom:'8px'}}>Staking — Coming Soon</h3>
          <p style={{color:'#94a3b8', fontSize:'0.9rem'}}>MGX community distribution is in progress.</p>
          <p style={{color:'#94a3b8', fontSize:'0.9rem'}}>Staking rewards will be available after distribution completes.</p>
        </div>
      </div>
    ) : walletSubView === "stake" ? (
      <div className="staking-container wallet-staking-layout">
        <div className="wallet-staking-header">
          <button type="button" className="secondary-button wallet-staking-back" onClick={() => setWalletSubView("main")}>
            &larr; Back to Wallet
          </button>
          <strong className="wallet-staking-title">Staking</strong>
        </div>

        <div className="wallet-staking-cards">
          <article className="dashboard-card action-card wallet-staking-card wallet-staking-premium-card">
            <div className="wallet-staking-action-grid">
              <button
                type="button"
                className="btn-stake-action wallet-staking-action-btn"
                onClick={() => setWalletSubView("stake")}
              >
                Add More Stake
              </button>
              <button
                type="button"
                className="btn-stake-action wallet-staking-action-btn is-claim"
                disabled={isLoading || !snapshot.walletAddress || !hasClaimableReward}
                onClick={() =>
                  runWalletAction(
                    () => metaguildx.claimReward(displayedPendingStakingReward, rewardWindowReady),
                    "Claiming staking reward...",
                    "Reward claimed",
                    (_nextSnapshot: any, result: any) => ({
                      title: "Reward claimed successfully",
                      detail: `Successfully claimed ${result.claimedReward} MGX.`
                    })
                  )
                }
              >
                Claim Reward
              </button>
              <button
                type="button"
                className="btn-stake-action wallet-staking-action-btn is-compound"
                disabled={isLoading || !snapshot.walletAddress || !hasClaimableReward}
                onClick={() =>
                  runWalletAction(
                    () => metaguildx.compoundReward(),
                    "Compounding reward...",
                    "Reward compounded",
                    () => ({
                      title: "Reward compounded",
                      detail: "The available staking reward has been added back into your position."
                    })
                  )
                }
              >
                Compound Reward
              </button>
              <button
                type="button"
                className="btn-stake-action danger wallet-staking-action-btn"
                disabled={isLoading || !snapshot.walletAddress || !hasWithdrawableStake}
                onClick={() => setWalletSubView("myStake")}
              >
                Withdraw
              </button>
            </div>
          </article>

          <article className="dashboard-card action-card wallet-staking-card wallet-staking-premium-card">
            <div className="section-header">
              <span className="section-badge purple">STAKE MGX</span>
            </div>
            <div className="stake-position-card wallet-staking-form-card" style={{textAlign:'center', padding:'32px 16px'}}>
              <div style={{fontSize:'2.5rem', marginBottom:'12px'}}>🔒</div>
              <h3 style={{color:'#a78bfa', marginBottom:'8px'}}>Staking — Coming Soon</h3>
              <p style={{color:'#94a3b8', fontSize:'0.9rem'}}>MGX community distribution is in progress.</p>
              <p style={{color:'#94a3b8', fontSize:'0.9rem'}}>Staking program will launch after distribution completes.</p>
            </div>
          </article>
        </div>
      </div>
    ) : walletSubView === "myStake" ? (
      <div className="staking-container">
        <div className="staking-header">
          <button type="button" className="btn-back" onClick={() => setWalletSubView("main")}>
            &larr; Back
          </button>
          <h3>My Staking</h3>
          <button type="button" className="btn-refresh-reward" onClick={handleRefreshRewards} disabled={isLoading || !snapshot.walletAddress}>
            Refresh
          </button>
        </div>

        <div className="stake-position-card stake-position-card-premium">
          <div className="stake-details">
            <div className="stake-detail-row">
              <span>Staking Positions</span>
              <span className="green">{displayedStakePositions.length}</span>
            </div>
            <div className="stake-detail-row">
              <span>Total Pool Staked</span>
              <span className="green">{asMgx(displayedTotalStaked)}</span>
            </div>
          </div>

          {displayedStakePositions.length > 0 ? (
            <div className="stake-position-list">
              {displayedStakePositions.map((position: any) => (
                <article key={`stake-position-${position.index}`} className="stake-position-item stake-position-item-premium">
                  <div className="stake-position-item-header">
                    <strong>{`Position ${position.index + 1}`}</strong>
                    <span className="section-badge purple">{position.lockDurationLabel}</span>
                  </div>
                  <div className="stake-position-grid">
                    <div className="stake-stat">
                      <span className="stake-label">Staked</span>
                      <span className="stake-value">{position.amount} MGX</span>
                    </div>
                    <div className="stake-stat">
                      <span className="stake-label">Pending Reward</span>
                      <span className="stake-value green">{position.pendingReward} MGX</span>
                    </div>
                    <div className="stake-stat">
                      <span className="stake-label">Started</span>
                      <span className="stake-value">{position.startDateLabel}</span>
                    </div>
                    <div className="stake-stat">
                      <span className="stake-label">Locked Until</span>
                      <span className="stake-value">{position.unlockDateLabel}</span>
                    </div>
                    <div className="stake-stat">
                      <span className="stake-label">Auto-Compound</span>
                      <span className={`stake-value ${position.autoCompound ? "green" : "dim"}`}>
                        {position.autoCompound ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <div className="stake-lock-progress">
                    <div className="stake-lock-progress-header">
                      <span>Lock Progress</span>
                      <span>{position.lockProgressPercent.toFixed(3)}% complete</span>
                    </div>
                    <div className="upgrade-progress-bar">
                      <span className="upgrade-progress-fill" style={{ width: `${position.lockProgressPercent}%` }} />
                    </div>
                  </div>
                  <div className="stake-action-grid">
                    <button
                      type="button"
                      className="btn-stake-action is-claim"
                      title={canUseIndexedStakingActions ? undefined : "Indexed staking actions need Core contract wrappers before they can be sent from the dashboard."}
                      disabled={isLoading || !snapshot.walletAddress || !canUseIndexedStakingActions || parseDisplayNumber(position.pendingReward) <= 0 || !rewardWindowReady}
                      onClick={() =>
                        runWalletAction(
                          () => metaguildx.claimReward(position.pendingReward, rewardWindowReady),
                          "Claiming staking reward...",
                          "Reward claimed",
                          (_nextSnapshot: any, result: any) => ({
                            title: "Reward claimed successfully",
                            detail: `Successfully claimed ${result.claimedReward} MGX.`
                          })
                        )
                      }
                    >
                      Claim Reward
                    </button>
                    <button
                      type="button"
                      className="btn-stake-action is-compound"
                      title={canUseIndexedStakingActions ? undefined : "Indexed staking actions need Core contract wrappers before they can be sent from the dashboard."}
                      disabled={isLoading || !snapshot.walletAddress || !canUseIndexedStakingActions || parseDisplayNumber(position.pendingReward) <= 0}
                      onClick={() =>
                        runWalletAction(
                          () => metaguildx.compoundReward(),
                          "Compounding reward...",
                          "Reward compounded",
                          () => ({
                            title: "Reward compounded",
                            detail: "The available staking reward has been added back into your position."
                          })
                        )
                      }
                    >
                      Compound Reward
                    </button>
                    <button
                      type="button"
                      className="btn-stake-action danger"
                      title={
                        position.isLocked
                          ? `Locked until ${position.unlockDateLabel}`
                          : canUseIndexedStakingActions
                          ? undefined
                          : "Indexed staking actions need Core contract wrappers before they can be sent from the dashboard."
                      }
                      disabled={
                        isLoading ||
                        !snapshot.walletAddress ||
                        !canUseIndexedStakingActions ||
                        position.isLocked ||
                        parseDisplayNumber(position.amount) <= 0
                      }
                      onClick={() =>
                        runWalletAction(
                          () => metaguildx.withdrawStakeTokens({ amount: parseDisplayNumber(position.amount) }),
                          "Withdrawing staked MGX...",
                          "Stake withdrawn",
                          () => ({
                            title: "Stake withdrawn successfully",
                            detail: "Your staked MGX has been returned to your available allocation."
                          })
                        )
                      }
                    >
                      Withdraw
                    </button>
                  </div>
                  {position.isLocked ? <p className="warning-text">{`This stake is locked until ${position.unlockDateLabel}.`}</p> : null}
                </article>
              ))}
              {!canUseIndexedStakingActions ? (
                <p className="warning-text">
                  Position-specific claim, compound, and withdraw actions need indexed Core wrappers. The dashboard now shows every position, but on-chain action routing still supports only the legacy combined flow.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="no-stake-state">
              <span>No active stake</span>
              <button type="button" className="btn-start-stake" onClick={() => setWalletSubView("stake")}>
                Start Staking
              </button>
            </div>
          )}
        </div>
      </div>
    ) : walletSubView === "cashback" ? (
      <div className="staking-container">
        <div className="staking-header">
          <button type="button" className="btn-back" onClick={() => setWalletSubView("main")}>
            &larr; Back to Wallet
          </button>
          <h3>Cashback Pool</h3>
          <button type="button" className="btn-refresh-reward" onClick={() => void handleRefreshSection("Cashback")} disabled={isLoading}>
            Refresh
          </button>
        </div>

        <article className="dashboard-card action-card cashback-panel">
          <div className="section-header">
            <span className="section-badge orange">CASHBACK POOL</span>
          </div>
          <div className="cashback-status-card">
            <div className="cashback-status-icon">CB</div>
            <div className="cashback-status-copy">
              <span className="token-name">Cashback Status</span>
              <span className="cashback-status-badge">Available after surrender window</span>
            </div>
            <div className="token-amount cashback-status-amount">
              <span className="amount-main">${parseDisplayNumber(snapshot.pendingCashback).toFixed(2)}</span>
              <span className="amount-sub">{parseDisplayNumber(snapshot.pendingCashback) > 0 ? "Ready" : "No cashback"}</span>
            </div>
          </div>
          <div className="cashback-info-grid">
            <div className="cashback-info-row">
              <span>Pool Balance</span>
              <strong>{`$${snapshot.cashbackPoolBalance}`}</strong>
            </div>
            <div className="cashback-info-row">
              <span>Status</span>
              <strong>{snapshot.surrenderStatus}</strong>
            </div>
            <div className="cashback-info-row">
              <span>Surrender Rule</span>
              <strong>3 to 6 month window</strong>
            </div>
          </div>
          <div className="cashback-notice-banner">
            Claim is disabled in the current live deployment.
          </div>
          <div className="flex justify-center sm:justify-start">
            <button type="button" className="btn-primary-large cashback-view-btn w-full sm:w-auto" title="Available after mainnet launch" disabled>
              View Cashback ?
            </button>
          </div>
          {parseDisplayNumber(snapshot.pendingCashback) === 0 ? (
            <p className="status-text text-center">No cashback yet</p>
          ) : null}
        </article>
      </div>
    ) : (
    <div className="wallet-container">
      <div className="wallet-section balance-section">
        <div className="section-header">
          <span className="section-badge blue">CONNECTED WALLET</span>
          <button type="button" className="btn-refresh-reward" onClick={() => void handleRefreshSection("Wallet")} disabled={isLoading}>
            ? Refresh
          </button>
        </div>
      <div className="wallet-address-row">
          <div className="wallet-address premium-wallet-address" title={snapshot.walletAddress ?? "Wallet pending"}>
            <div className="premium-wallet-address-copy">
              <span className="premium-wallet-address-label">Connected Wallet</span>
              <span>{shortWalletAddress}</span>
            </div>
            <button type="button" className="premium-wallet-copy-btn" onClick={handleCopyWalletAddress} disabled={!snapshot.walletAddress}>Copy</button>
          </div>
          <button type="button" className="btn-disconnect" onClick={handleLogout} disabled={isLoading}>
            Disconnect
          </button>
        </div>
        <div className="wallet-total-balance wallet-total-balance-premium">
          <span className="balance-label">Total Balance</span>
          <span className={`balance-amount ${parseFloat(connectedWalletTotalDisplay) > 0 ? "is-positive" : ""}`}>${connectedWalletTotalDisplay}</span>
        </div>
        <div className="wallet-action-buttons premium-action-grid" style={{gridTemplateColumns:"repeat(2,1fr)",maxWidth:500,margin:"0 auto",gap:12}}>
          <button type="button" className="btn-action premium-action-card" onClick={() => { setDashboardView("wallet"); setWalletSubView("mgxboxes"); }}>
            <span className="premium-action-icon">💎</span>
            <span className="premium-action-title">Inner Wallet</span>
            <span className="premium-action-subtitle">Transfer earnings to wallet</span>
          </button>
          <button
            type="button"
            className="btn-action premium-action-card"
            onClick={() => {
              setDashboardView("wallet");
              setWalletSubView("stakingclaim");
            }}
          >
            <span className="premium-action-icon">🎁</span>
            <span className="premium-action-title">Reward Wallet</span>
            <span className="premium-action-subtitle">Claim platform rewards</span>
          </button>
          <button type="button" className="btn-action premium-action-card" onClick={() => { setDashboardView("wallet"); setWalletSubView("stake"); }}>
            <span className="premium-action-icon">🔒</span>
            <span className="premium-action-title">Staking</span>
            <span className="premium-action-subtitle">Stake MGX tokens</span>
            {parseDisplayNumber(displayedPersonalStaked) > 0 ? (
              <span className="premium-action-badge">{`${displayedPersonalStaked} MGX staked`}</span>
            ) : null}
          </button>
          <button type="button" className="btn-action premium-action-card" onClick={() => { setDashboardView("wallet"); setWalletSubView("cashback"); }}>
            <span className="premium-action-icon">💰</span>
            <span className="premium-action-title">Cashback Pool</span>
            <span className="premium-action-subtitle">View cashback status</span>
          </button>
        </div>
      </div>

      <div className="wallet-section balance-section premium-balance-section">
        <div className="section-header">
          <span className="section-badge orange">INNER BALANCE</span>
          <span className="section-sub">Platform earnings and managed balances</span>
        </div>
        <div className="balance-row premium-balance-row">
          <div className="token-icon">ESC</div>
          <div className="token-info">
            <span className="token-name">Frozen (Auto-Upgrade)</span>
            <span className="token-sub">Current package escrow</span>
          </div>
          <div className="token-amount">
            <span className="amount-main">${frozenEscrowDisplay}</span>
          </div>
        </div>
        <div className="balance-row premium-balance-row">
          <div className="token-icon mgx-icon">MGX</div>
          <div className="token-info">
            <span className="token-name">MGX Staked</span>
            <span className="token-sub">Active staking positions</span>
          </div>
          <div className="token-amount">
            <span className="amount-main">{displayedPersonalStaked}</span>
            <span className="amount-sub">MGX</span>
          </div>
        </div>
        <div className="balance-row premium-balance-row">
          <div className="token-icon mgx-icon">MGX</div>
          <div className="token-info">
            <span className="token-name">MGX Allocated (Total)</span>
            <span className="token-sub">Primary + rebirth allocations</span>
          </div>
          <div className="token-amount">
            <span className="amount-main">{displayedTotalMgxAllocated}</span>
            <span className="amount-sub">MGX</span>
          </div>
        </div>
      </div>

      <div className="wallet-section escrow-section premium-balance-section">
        <div className="section-header">
          <span className="section-badge blue">WALLET BALANCE</span>
          <span className="section-sub">{shortWalletAddress}</span>
        </div>
        {isConnectedWalletLoading ? <p className="status-text">Loading connected wallet assets...</p> : null}
        {snapshot.connectedWalletAssetsError ? (
          <p className="warning-text">Unable to load wallet assets right now. Please try again.</p>
        ) : null}
        <div className="balance-row premium-balance-row">
          <div className="token-icon">USDT</div>
          <div className="token-info">
            <span className="token-name">USDT</span>
            <span className="token-sub">External wallet balance</span>
          </div>
          <div className="token-amount">
            <span className="amount-main amount-main-highlight">{outerUsdtBalanceDisplay}</span>
            <span className="amount-sub">USDT</span>
          </div>
        </div>
        <div className="balance-row premium-balance-row">
          <div className="token-icon">BNB</div>
          <div className="token-info">
            <span className="token-name">opBNB Gas</span>
            <span className="token-sub">Native gas balance</span>
          </div>
          <div className="token-amount">
            <span className="amount-main">{opBnbGasDisplay}</span>
            <span className="amount-sub">BNB</span>
          </div>
        </div>
        <div className="balance-row premium-balance-row">
          <div className="token-icon mgx-icon">MGX</div>
          <div className="token-info">
            <span className="token-name">MGX</span>
            <span className="token-sub">Available MGX</span>
          </div>
          <div className="token-amount">
            <span className="amount-main">{mgxAvailableDisplay}</span>
            <span className="amount-sub">MGX</span>
          </div>
        </div>
      </div>

      <div className="wallet-section balance-section">
        <div className="section-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <span className="section-badge blue">Recent Wallet Activity</span>
          <button type="button" className="btn-refresh-reward" onClick={() => void handleLoadMoreHistory()} disabled={isConnectedWalletHistoryLoading}>
            {isConnectedWalletHistoryLoading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>
        <div className="space-y-3">
          {connectedWalletHistoryRows.length > 0 ? (
            connectedWalletHistoryRows.slice(0, 10).map((row: any) => (
              <div key={row.hash} className="tx-row">
                <div>
                  <div className="income-label">{row.type}</div>
                  <div className="income-sublabel">{row.date}</div>
                </div>
                <div className="text-right">
                  <div className="token-amount">{row.amount}</div>
                  <div className="token-usd">{row.status}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <p className="empty-state-text">No transaction history available yet.</p>
            </div>
          )}
          {snapshot.connectedWalletHistoryError ? <p className="warning-text">{snapshot.connectedWalletHistoryError}</p> : null}
        </div>
      </div>
    </div>
    )}
  </section>
  );
}
