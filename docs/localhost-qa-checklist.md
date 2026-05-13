# Localhost QA Checklist

## Goal

Validate the MetaGuildX project in test mode without deploying to OPBNB.

## Frontend QA

### Landing Page

- Open `http://127.0.0.1:5173`
- Hard refresh with `Ctrl + Shift + R`
- Confirm:
  - logo is visible
  - top menu is visible
  - package rule section is visible
  - connect wallet button works

### Dashboard Navigation

Confirm all main dashboard sections open correctly:

- Overview
- Tree
- Income
- Referrals
- Level Summary
- Rebirth
- Internal Wallet
- Wallet Actions
- Blueprint

### Overview Page

Confirm:

- wallet address stays inside the box
- package progress is aligned
- box spacing is clean
- summary cards are readable

### Tree Page

Confirm:

- tree nodes load
- node selection works
- breadcrumb works
- direct downline section is visible
- node details show correctly

### Income Page

Confirm:

- income summary loads
- current running box loads
- income history loads

### Referrals Page

Confirm:

- referral summary loads
- referral link copy works
- direct referral list loads

### Level Summary Page

Confirm:

- unlocked level summary loads
- level table loads
- package wording is correct

### Rebirth Page

Confirm:

- rebirth tracking is visible
- rebirth status is readable

### Internal Wallet Page

Confirm:

- internal wallet amounts display correctly
- withdrawal context is readable

### Blueprint Page

Confirm:

- main blueprint information is complete
- roadmap, package ladder, token model, box model, staking, rules, and contract details are visible

## Wallet Action QA

Connect wallet on localhost chain:

- RPC: `http://127.0.0.1:8545`
- Chain ID: `31337`

Test the following actions:

- Register new wallet
- Upgrade to next package
- Stake
- Claim reward
- Compound reward

Confirm after each:

- success message appears
- dashboard updates
- recent actions section updates

## Backend QA

Run:

- `npm --workspace @metaguildx/contracts run test`

Confirm:

- all tests pass
- localhost deployment file exists
- frontend `.env.local` points to current localhost contract

Files to verify:

- `contracts/deployments/localhost.json`
- `apps/web/.env.local`

## Pass Condition

The localhost QA pass is successful when:

- wallet connection works
- contract reads work
- contract writes work
- no stale contract address issue appears
- all main pages open correctly
- tests pass

## Notes

- This checklist is for test mode only
- Do not use this as a production deployment checklist
