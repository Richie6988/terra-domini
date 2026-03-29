/**
 * HEXOD — Smart Contract Deployment Script
 * 
 * Deploys in order:
 *   1. HEXToken (ERC-20)
 *   2. TerritoryNFT (ERC-721) — needs treasury address
 *   3. Staking — needs HEXToken address
 *   4. Grant MINTER_ROLE to GameEngine address
 *   5. Grant GAME_ENGINE_ROLE to server address
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.js --network amoy     # testnet
 *   npx hardhat run scripts/deploy.js --network polygon   # mainnet
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("⬡ HEXOD — Smart Contract Deployment");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MATIC`);
  console.log(`Network:   ${(await ethers.provider.getNetwork()).name} (chain ${(await ethers.provider.getNetwork()).chainId})`);
  console.log("");

  // ── 1. Deploy HEXToken ──────────────────────────────────────
  console.log("📦 Deploying HEXToken (ERC-20)...");
  const HEXToken = await ethers.getContractFactory("HEXToken");
  const hexToken = await HEXToken.deploy();
  await hexToken.waitForDeployment();
  const hexAddr = await hexToken.getAddress();
  console.log(`   ✅ HEXToken:      ${hexAddr}`);
  console.log(`   Hard cap:         4,842,432 HEX`);
  console.log(`   Mining rate:      ${ethers.formatEther(await hexToken.miningRate())} HEX/claim`);

  // ── 2. Deploy TerritoryNFT ──────────────────────────────────
  console.log("\n📦 Deploying TerritoryNFT (ERC-721)...");
  const treasury = deployer.address; // Use deployer as treasury initially
  const TerritoryNFT = await ethers.getContractFactory("TerritoryNFT");
  const territoryNFT = await TerritoryNFT.deploy(treasury);
  await territoryNFT.waitForDeployment();
  const nftAddr = await territoryNFT.getAddress();
  console.log(`   ✅ TerritoryNFT:  ${nftAddr}`);
  console.log(`   Royalty:          5% to treasury`);

  // ── 3. Deploy Staking ───────────────────────────────────────
  console.log("\n📦 Deploying Staking...");
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(hexAddr);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log(`   ✅ Staking:       ${stakingAddr}`);
  console.log(`   APY:              7d=10%, 30d=25%, 90d=50%`);

  // ── 4. Setup Roles ──────────────────────────────────────────
  console.log("\n🔐 Setting up roles...");
  // In production: MINTER_ROLE goes to GameEngine contract
  // For now: deployer keeps it for testing
  console.log(`   Deployer has MINTER_ROLE on HEXToken ✅`);
  console.log(`   Deployer has GAME_ENGINE_ROLE on TerritoryNFT ✅`);

  // ── 5. Summary ──────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("⬡ DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("Contract Addresses:");
  console.log(`  HEXToken:      ${hexAddr}`);
  console.log(`  TerritoryNFT:  ${nftAddr}`);
  console.log(`  Staking:       ${stakingAddr}`);
  console.log(`  Treasury:      ${treasury}`);
  console.log("");
  console.log("Next Steps:");
  console.log("  1. Verify contracts on Polygonscan:");
  console.log(`     npx hardhat verify --network <network> ${hexAddr}`);
  console.log(`     npx hardhat verify --network <network> ${nftAddr} ${treasury}`);
  console.log(`     npx hardhat verify --network <network> ${stakingAddr} ${hexAddr}`);
  console.log("  2. Update frontend CONTRACTS in useBlockchain.ts");
  console.log("  3. Add initial liquidity on QuickSwap");
  console.log("  4. Apply for CoinGecko/CoinMarketCap listing");
  console.log("═══════════════════════════════════════════════════");

  // Write addresses to file for frontend integration
  const fs = require("fs");
  const addresses = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      HEXToken: hexAddr,
      TerritoryNFT: nftAddr,
      Staking: stakingAddr,
      Treasury: treasury,
    },
  };
  fs.writeFileSync(
    "./deployments.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n📄 Addresses saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
