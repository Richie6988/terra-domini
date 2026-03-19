// hardhat.config.ts — Polygon deployment config
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env' })

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
    },
    // Polygon Mumbai testnet
    mumbai: {
      url: process.env.BLOCKCHAIN_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
      chainId: 80001,
      accounts: process.env.TDC_TREASURY_PRIVATE_KEY
        ? [process.env.TDC_TREASURY_PRIVATE_KEY]
        : [],
      gasPrice: 'auto',
    },
    // Polygon mainnet
    polygon: {
      url: process.env.BLOCKCHAIN_RPC_URL || 'https://polygon-rpc.com',
      chainId: 137,
      accounts: process.env.TDC_TREASURY_PRIVATE_KEY
        ? [process.env.TDC_TREASURY_PRIVATE_KEY]
        : [],
      gasPrice: 'auto',
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || '',
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || '',
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
}

export default config
