"""
Blockchain Service — TDC cryptocurrency integration.
Web3.py interface to TerraDominiCoin ERC-20 on Polygon.
Handles: purchase minting, in-game balance management, withdrawals.
"""
import json
import logging
import uuid
from decimal import Decimal
from typing import Optional

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from web3 import Web3
# web3 v7 renamed geth_poa_middleware → ExtraDataToPOAMiddleware
try:
    from web3.middleware import ExtraDataToPOAMiddleware as geth_poa_middleware
except ImportError:
    try:
        from web3.middleware import geth_poa_middleware  # web3 v6
    except ImportError:
        geth_poa_middleware = None
from eth_account import Account

logger = logging.getLogger('terra_domini.blockchain')

BLOCKCHAIN_CFG = settings.BLOCKCHAIN

# ABI subset — only the functions we call
TDC_ABI = json.loads("""[
  {"type":"function","name":"mint","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"earnInGame","inputs":[{"name":"player","type":"address"},{"name":"amount","type":"uint256"},{"name":"reason","type":"string"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"inGameBalance","inputs":[{"name":"","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"balanceOf","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"playerTotalBalance","inputs":[{"name":"player","type":"address"}],"outputs":[{"name":"wallet","type":"uint256"},{"name":"inGame","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},
  {"type":"event","name":"InGameDeposit","inputs":[{"name":"player","type":"address","indexed":true},{"name":"amount","type":"uint256"}]},
  {"type":"event","name":"InGameSpend","inputs":[{"name":"player","type":"address","indexed":true},{"name":"amount","type":"uint256"},{"name":"itemCode","type":"string"}]},
  {"type":"event","name":"InGameEarn","inputs":[{"name":"player","type":"address","indexed":true},{"name":"amount","type":"uint256"},{"name":"reason","type":"string"}]}
]""")


class BlockchainService:
    """Singleton-style service. Instantiate once per process."""

    _instance = None

    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(BLOCKCHAIN_CFG['RPC_URL']))
        if geth_poa_middleware: self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)  # Polygon PoS

        if not self.w3.is_connected():
            logger.error("Cannot connect to blockchain RPC")

        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(BLOCKCHAIN_CFG['TDC_CONTRACT']),
            abi=TDC_ABI,
        )
        self.treasury_account = Account.from_key(BLOCKCHAIN_CFG['TREASURY_PRIVATE_KEY'])
        self.chain_id = BLOCKCHAIN_CFG['CHAIN_ID']
        logger.info(f"BlockchainService initialized. Chain: {self.chain_id}, Treasury: {self.treasury_account.address}")

    @classmethod
    def get(cls) -> 'BlockchainService':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ─── TDC Purchase (fiat → TDC) ───────────────────────────────────────────

    def mint_for_purchase(self, player_wallet: str, eur_amount: Decimal, purchase_id: str) -> Optional[str]:
        """
        Mint TDC to player wallet after fiat purchase.
        1 EUR = BLOCKCHAIN_CFG['TDC_EUR_RATE'] TDC
        Returns tx_hash or None on failure.
        """
        if not self._is_valid_address(player_wallet):
            raise ValueError(f"Invalid wallet address: {player_wallet}")

        tdc_amount = int(eur_amount * BLOCKCHAIN_CFG['TDC_EUR_RATE'] * 10**18)
        checksum_address = Web3.to_checksum_address(player_wallet)

        try:
            tx = self.contract.functions.mint(checksum_address, tdc_amount).build_transaction({
                'chainId': self.chain_id,
                'gas': 150_000,
                'gasPrice': self._get_gas_price(),
                'nonce': self.w3.eth.get_transaction_count(self.treasury_account.address),
            })
            signed = self.treasury_account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

            if receipt.status == 1:
                tx_hash_hex = tx_hash.hex()
                logger.info(f"Minted {tdc_amount/10**18:.2f} TDC to {player_wallet} | tx: {tx_hash_hex}")
                return tx_hash_hex
            else:
                logger.error(f"Mint tx failed: {tx_hash.hex()}")
                return None

        except Exception as e:
            logger.error(f"Mint error for purchase {purchase_id}: {e}", exc_info=True)
            return None

    # ─── In-game credits (ad revenue, rewards) ───────────────────────────────

    def credit_ad_revenue(self, player_wallet: str, tdc_amount: Decimal, territory_h3: str) -> Optional[str]:
        """
        Credit in-game TDC balance for ad revenue (territory billboard).
        Calls earnInGame on contract — mints new TDC held by contract.
        """
        wei_amount = int(tdc_amount * 10**18)
        reason = f"ad_revenue:{territory_h3}"

        try:
            tx = self.contract.functions.earnInGame(
                Web3.to_checksum_address(player_wallet),
                wei_amount,
                reason
            ).build_transaction({
                'chainId': self.chain_id,
                'gas': 100_000,
                'gasPrice': self._get_gas_price(),
                'nonce': self.w3.eth.get_transaction_count(self.treasury_account.address),
            })
            signed = self.treasury_account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

            if receipt.status == 1:
                return tx_hash.hex()
            return None

        except Exception as e:
            logger.error(f"earnInGame error: {e}", exc_info=True)
            return None

    # ─── Balance reads ────────────────────────────────────────────────────────

    def get_player_balance(self, wallet_address: str) -> dict:
        """Returns both wallet and in-game TDC balances."""
        if not self._is_valid_address(wallet_address):
            return {'wallet': 0, 'in_game': 0}
        try:
            checksum = Web3.to_checksum_address(wallet_address)
            wallet_wei, ingame_wei = self.contract.functions.playerTotalBalance(checksum).call()
            return {
                'wallet': float(wallet_wei / 10**18),
                'in_game': float(ingame_wei / 10**18),
            }
        except Exception as e:
            logger.error(f"Balance read error for {wallet_address}: {e}")
            return {'wallet': 0, 'in_game': 0}

    def get_tdc_market_price_eur(self) -> float:
        """
        Fetch TDC/EUR rate from Polygon DEX (Uniswap V3).
        Fallback to fixed rate if DEX is unavailable.
        TODO: implement actual DEX price oracle.
        """
        return 1.0 / BLOCKCHAIN_CFG['TDC_EUR_RATE']

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _get_gas_price(self) -> int:
        """Get current gas price with 10% buffer."""
        try:
            return int(self.w3.eth.gas_price * 1.1)
        except Exception:
            return Web3.to_wei('30', 'gwei')  # Fallback: 30 gwei for Polygon

    @staticmethod
    def _is_valid_address(address: str) -> bool:
        try:
            return Web3.is_address(address)
        except Exception:
            return False


# ─── Django models for off-chain transaction tracking ────────────────────────

class TDCTransaction(models.Model):
    """Off-chain record of all TDC movements. Source of truth for disputes."""

    class TransactionType(models.TextChoices):
        PURCHASE = 'purchase', 'Fiat Purchase'
        AD_REVENUE = 'ad_revenue', 'Ad Revenue'
        REWARD = 'reward', 'Game Reward'
        ITEM_PURCHASE = 'item_purchase', 'Item Purchase'
        WITHDRAWAL = 'withdrawal', 'Wallet Withdrawal'
        SEASON_REWARD = 'season_reward', 'Season Reward'
        ALLIANCE_TRANSFER = 'alliance_transfer', 'Alliance Transfer'
        REFUND = 'refund', 'Refund'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='tdc_transactions'
    )

    transaction_type = models.CharField(max_length=30, choices=TransactionType.choices)
    amount_tdc = models.DecimalField(max_digits=20, decimal_places=6)
    amount_eur = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Blockchain reference
    tx_hash = models.CharField(max_length=66, blank=True, db_index=True)
    block_number = models.BigIntegerField(null=True, blank=True)
    from_address = models.CharField(max_length=42, blank=True)
    to_address = models.CharField(max_length=42, blank=True)

    # Game context
    item_code = models.CharField(max_length=100, blank=True)
    territory_h3 = models.CharField(max_length=20, blank=True)
    metadata = models.JSONField(default=dict)

    status = models.CharField(max_length=20, default='pending')
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'tdc_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['player', 'transaction_type']),
            models.Index(fields=['created_at']),
            models.Index(fields=['status']),
        ]


class PurchaseOrder(models.Model):
    """Fiat → TDC purchase flow. Initiated by player, fulfilled by webhook."""

    class OrderStatus(models.TextChoices):
        PENDING = 'pending', 'Pending Payment'
        PAID = 'paid', 'Paid — Awaiting Minting'
        MINTING = 'minting', 'Minting on Chain'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        REFUNDED = 'refunded', 'Refunded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    eur_amount = models.DecimalField(max_digits=10, decimal_places=2)
    tdc_amount = models.DecimalField(max_digits=20, decimal_places=6)
    bonus_tdc = models.DecimalField(max_digits=20, decimal_places=6, default=0)  # Promotional bonus

    payment_provider = models.CharField(max_length=30, default='stripe')
    payment_intent_id = models.CharField(max_length=100, unique=True, db_index=True)
    payment_method = models.CharField(max_length=30, blank=True)

    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    tdc_transaction = models.OneToOneField(
        TDCTransaction, null=True, blank=True, on_delete=models.SET_NULL
    )

    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'purchase_orders'
        ordering = ['-created_at']


class AdCampaignRevenue(models.Model):
    """Daily ad revenue earned by territory owners."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    territory = models.ForeignKey('territories.Territory', on_delete=models.CASCADE)
    campaign = models.ForeignKey('economy.AdCampaign', on_delete=models.CASCADE)
    player = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField()
    impressions = models.IntegerField(default=0)
    revenue_tdc = models.DecimalField(max_digits=20, decimal_places=6, default=0)
    player_share_tdc = models.DecimalField(max_digits=20, decimal_places=6, default=0)  # 70%
    platform_share_tdc = models.DecimalField(max_digits=20, decimal_places=6, default=0)  # 30%
    paid_out = models.BooleanField(default=False)
    payout_tx = models.CharField(max_length=66, blank=True)

    class Meta:
        db_table = 'ad_campaign_revenue'
        unique_together = ['territory', 'campaign', 'date']


# ─── Dual Currency Wallet ──────────────────────────────────────────────────
class CryptoWallet(models.Model):
    """
    Each player has an internal TDI (Terra Domini Invest) balance.
    When TDC is purchased with real money → TDI credited at current MATIC rate.
    TDI can be: reinvested into TDC, held as crypto, or withdrawn to external wallet.
    """
    player          = models.OneToOneField('accounts.Player', on_delete=models.CASCADE, related_name='crypto_wallet')
    tdi_balance     = models.DecimalField(max_digits=18, decimal_places=8, default=0)  # internal TDI
    tdi_staked      = models.DecimalField(max_digits=18, decimal_places=8, default=0)  # staked in game
    tdi_pending_withdraw = models.DecimalField(max_digits=18, decimal_places=8, default=0)
    total_tdi_earned  = models.DecimalField(max_digits=18, decimal_places=8, default=0)
    total_tdi_withdrawn = models.DecimalField(max_digits=18, decimal_places=8, default=0)
    external_wallet   = models.CharField(max_length=42, blank=True)  # 0x... Polygon address
    kyc_verified      = models.BooleanField(default=False)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crypto_wallet'


class TDITransaction(models.Model):
    """Ledger for all TDI movements."""
    TX_TYPES = [
        ('purchase_bonus', 'TDC Purchase Bonus'),
        ('territory_yield', 'Territory Daily Yield'),
        ('stake_reward', 'Staking Reward'),
        ('withdraw', 'Withdrawal to External Wallet'),
        ('convert_to_tdc', 'Convert TDI → TDC'),
        ('referral_bonus', 'Referral Bonus'),
    ]
    player      = models.ForeignKey('accounts.Player', on_delete=models.CASCADE, related_name='tdi_transactions')
    tx_type     = models.CharField(max_length=30, choices=TX_TYPES)
    amount_tdi  = models.DecimalField(max_digits=18, decimal_places=8)
    matic_rate  = models.DecimalField(max_digits=10, decimal_places=6, null=True)  # rate at time of tx
    usd_value   = models.DecimalField(max_digits=12, decimal_places=4, null=True)
    tx_hash     = models.CharField(max_length=66, blank=True)  # on-chain if withdrawn
    note        = models.CharField(max_length=200, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tdi_transaction'
        ordering = ['-created_at']


class CryptoPriceCache(models.Model):
    """Cached crypto prices from CoinGecko (updated every 5 min)."""
    symbol       = models.CharField(max_length=10, primary_key=True)  # MATIC, ETH, BTC, TDI
    price_usd    = models.DecimalField(max_digits=16, decimal_places=8)
    change_24h   = models.FloatField(default=0)
    volume_24h   = models.DecimalField(max_digits=20, decimal_places=2, null=True)
    market_cap   = models.DecimalField(max_digits=20, decimal_places=2, null=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crypto_price_cache'
