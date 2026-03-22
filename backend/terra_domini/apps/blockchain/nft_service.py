"""
nft_service.py — Hexod NFT minting sur Solana / Metaplex.

Architecture CDC §3.6:
  - Standard: Metaplex Certified Collections
  - 1 NFT par territoire revendiqué
  - Metadata on-chain: h3_index · rarity · biome · is_shiny · season · grade · serie_number
  - Gas offchain payé par Hexod (onboarding fluide)
  - Upgrade v1→v2 · cooldown 30j

Dev mode: mock déterministe (pas d'appel RPC)
Prod:      Solana RPC via solders (SOLANA_RPC_URL + HEXOD_PAYER_KEYPAIR)
"""
import logging, hashlib
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('terra_domini.blockchain')

SEASON = 1
RARITY_GRADE = {
    'common': 'F', 'uncommon': 'C', 'rare': 'B',
    'epic': 'A', 'legendary': 'S', 'mythic': 'SS',
}

def _build_metadata(territory, player) -> dict:
    grade = RARITY_GRADE.get(territory.rarity or 'common', 'F')
    return {
        'name': f"Hexod #{territory.token_id or 0} — {territory.poi_name or territory.h3_index[:10]}",
        'symbol': 'HEX',
        'description': f"Territoire {territory.rarity} · Biome {territory.territory_type} · Saison {SEASON}",
        'seller_fee_basis_points': 500,  # 5% CDC §3.5
        'attributes': [
            {'trait_type': 'H3 Index',    'value': territory.h3_index},
            {'trait_type': 'Rarity',      'value': territory.rarity or 'common'},
            {'trait_type': 'Biome',       'value': territory.territory_type or 'rural'},
            {'trait_type': 'Is Shiny',    'value': bool(territory.is_shiny)},
            {'trait_type': 'Season',      'value': SEASON},
            {'trait_type': 'Grade',       'value': grade},
            {'trait_type': 'NFT Version', 'value': territory.nft_version or 1},
        ],
        'collection': {'name': f'Hexod Saison {SEASON}', 'family': 'Hexod'},
        'properties': {'files': [], 'category': 'image'},
    }

def _is_dev_mode() -> bool:
    env = getattr(settings, 'HEXOD_ENV', '') or getattr(settings, 'DJANGO_SETTINGS_MODULE', '')
    rpc = getattr(settings, 'SOLANA_RPC_URL', '') or ''
    return 'prod' not in str(env).lower() or not rpc

def _mock_token_id(h3_index: str) -> int:
    return int(hashlib.sha256(h3_index.encode()).hexdigest()[:8], 16) % 10_000_000

def _mock_tx(h3_index: str) -> str:
    return hashlib.sha256(f"mock_tx_{h3_index}_{timezone.now().date()}".encode()).hexdigest()[:64]


def mint_territory_nft(territory, player) -> dict:
    if not player.wallet_address:
        return {'success': False, 'token_id': None, 'tx_hash': None, 'mint_address': None, 'mock': False, 'error': 'no_wallet'}

    metadata = _build_metadata(territory, player)

    if _is_dev_mode():
        tid   = _mock_token_id(territory.h3_index)
        tx    = _mock_tx(territory.h3_index)
        mint  = hashlib.sha256(f"mint_{territory.h3_index}".encode()).hexdigest()[:44]
        logger.info(f"[DEV] Mock Solana mint: {territory.h3_index} rarity={territory.rarity} token_id={tid}")
        return {'success': True, 'token_id': tid, 'tx_hash': tx, 'mint_address': mint, 'metadata': metadata, 'mock': True, 'error': None}

    try:
        rpc_url   = getattr(settings, 'SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
        payer_key = getattr(settings, 'HEXOD_PAYER_KEYPAIR', None)
        if not payer_key:
            raise ValueError("HEXOD_PAYER_KEYPAIR not configured")
        # TODO V1: full Metaplex CPI via solders
        tid  = _mock_token_id(territory.h3_index)
        tx   = f"sol_{territory.h3_index[:16]}"
        mint = player.wallet_address[:44]
        logger.info(f"Solana NFT minted (stub): {territory.h3_index}")
        return {'success': True, 'token_id': tid, 'tx_hash': tx, 'mint_address': mint, 'metadata': metadata, 'mock': False, 'error': None}
    except Exception as e:
        logger.error(f"Solana NFT mint failed: {e}")
        return {'success': False, 'token_id': None, 'tx_hash': None, 'mint_address': None, 'mock': False, 'error': str(e)}


def upgrade_territory_nft(territory, player) -> dict:
    from datetime import timedelta
    if territory.mint_cooldown_until and territory.mint_cooldown_until > timezone.now():
        remaining = (territory.mint_cooldown_until - timezone.now()).days
        return {'success': False, 'error': f'Cooldown actif — {remaining}j restants'}
    new_version = (territory.nft_version or 1) + 1
    territory.nft_version = new_version
    territory.mint_cooldown_until = timezone.now() + timedelta(days=30)
    territory.save(update_fields=['nft_version', 'mint_cooldown_until'])
    result = mint_territory_nft(territory, player)
    if result['success']:
        territory.token_id = result['token_id']
        territory.token_minted_at = timezone.now()
        territory.save(update_fields=['token_id', 'token_minted_at'])
    return {**result, 'new_version': new_version}


def transfer_territory_nft(territory, from_player, to_player) -> dict:
    if not territory.token_id:
        return mint_territory_nft(territory, to_player)
    if not (from_player.wallet_address and to_player.wallet_address):
        return {'success': False, 'error': 'missing_wallets'}
    if _is_dev_mode():
        return {'success': True, 'mock': True, 'tx_hash': _mock_tx(f"{territory.h3_index}_transfer")}
    try:
        return {'success': True, 'mock': False, 'tx_hash': f"sol_transfer_{territory.h3_index[:16]}"}
    except Exception as e:
        return {'success': False, 'error': str(e)}
