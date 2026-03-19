/**
 * Deploy TerraDominiCoin to Polygon.
 * Run: npx hardhat run scripts/deploy.ts --network polygon
 * Then update TDC_CONTRACT_ADDRESS in .env and redeploy backend.
 */
import { ethers, run, network } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log(`\nDeploying TerraDominiCoin`)
  console.log(`Network: ${network.name}`)
  console.log(`Deployer: ${deployer.address}`)
  console.log(`Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} MATIC\n`)

  // Treasury = deployer on testnet, use multisig on mainnet
  const treasuryAddress = process.env.TDC_TREASURY_ADDRESS || deployer.address
  const feeCollectorAddress = process.env.TDC_FEE_COLLECTOR || deployer.address

  console.log(`Treasury:      ${treasuryAddress}`)
  console.log(`Fee collector: ${feeCollectorAddress}\n`)

  // Deploy
  const TDC = await ethers.getContractFactory('TerraDominiCoin')
  const tdc = await TDC.deploy(treasuryAddress, feeCollectorAddress)
  await tdc.waitForDeployment()

  const address = await tdc.getAddress()
  const deployTx = tdc.deploymentTransaction()

  console.log(`✅ TerraDominiCoin deployed to: ${address}`)
  console.log(`   Deploy tx: ${deployTx?.hash}`)
  console.log(`   Block: ${deployTx ? 'pending' : 'unknown'}\n`)

  // Grant GAME_ROLE to backend treasury wallet
  // (backend calls earnInGame / spendInGame on behalf of players)
  const GAME_ROLE = ethers.keccak256(ethers.toUtf8Bytes('GAME_ROLE'))
  const backendWallet = process.env.TDC_BACKEND_WALLET || deployer.address
  console.log(`Granting GAME_ROLE to backend wallet: ${backendWallet}`)
  const grantTx = await tdc.grantRole(GAME_ROLE, backendWallet)
  await grantTx.wait()
  console.log(`✅ GAME_ROLE granted\n`)

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    contract_address: address,
    treasury: treasuryAddress,
    fee_collector: feeCollectorAddress,
    backend_wallet: backendWallet,
    deploy_tx: deployTx?.hash,
    deployed_at: new Date().toISOString(),
    chain_id: (await ethers.provider.getNetwork()).chainId.toString(),
  }

  const outPath = path.join(__dirname, `../deployments/${network.name}.json`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2))
  console.log(`📄 Deployment info saved to deployments/${network.name}.json`)

  // Print .env update
  console.log('\n─────────────────────────────────────────────')
  console.log('Update .env with:')
  console.log(`TDC_CONTRACT_ADDRESS=${address}`)
  console.log(`BLOCKCHAIN_CHAIN_ID=${deploymentInfo.chain_id}`)
  console.log('─────────────────────────────────────────────\n')

  // Verify on Polygonscan (skip on localhost)
  if (network.name !== 'hardhat') {
    console.log('Waiting 30s before verification…')
    await new Promise(r => setTimeout(r, 30000))

    try {
      await run('verify:verify', {
        address,
        constructorArguments: [treasuryAddress, feeCollectorAddress],
      })
      console.log('✅ Contract verified on Polygonscan')
    } catch (e: any) {
      if (e.message?.includes('Already Verified')) {
        console.log('Contract already verified')
      } else {
        console.warn(`⚠️  Verification failed: ${e.message}`)
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
