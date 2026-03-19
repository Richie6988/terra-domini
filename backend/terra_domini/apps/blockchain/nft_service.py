"""
NFT minting service — mint territory ownership on Polygon.
Each claimed territory becomes an ERC-721 NFT linked to the player's wallet.

In dev mode (no wallet configured): generates a mock token_id and logs the intent.
In prod: calls the TDC smart contract's mintTerritory() function.
"""
import logging
import hashlib
from django.conf import settings

logger = logging.getLogger('terra_domini.blockchain')

GAME_CONFIG = getattr(settings, 'GAME_CONFIG', {})


def _generate_mock_token_id(h3_index: str) -> int:
    """Deterministic mock token_id from H3 index (dev only)."""
    return int(hashlib.sha256(h3_index.encode()).hexdigest()[:8], 16)


def mint_territory_nft(territory, player) -> dict:
    """
    Mint an NFT for a claimed territory.
    
    Returns: {
        'success': bool,
        'token_id': int | None,
        'tx_hash': str | None,
        'mock': bool,  # True in dev mode
        'error': str | None,
    }
    """
    if not player.wallet_address:
        logger.debug(f"No wallet for {player.username} — skipping NFT mint")
        return {'success': False, 'token_id': None, 'tx_hash': None, 'mock': False, 'error': 'no_wallet'}

    # Dev mode — mock mint
    rpc_url = GAME_CONFIG.get('BLOCKCHAIN_RPC_URL') or getattr(settings, 'BLOCKCHAIN_RPC_URL', '')
    if not rpc_url or 'dev' in str(getattr(settings, 'DJANGO_SETTINGS_MODULE', '')):
        token_id = _generate_mock_token_id(territory.h3_index)
        logger.info(f"[DEV] Mock NFT mint: territory={territory.h3_index} player={player.username} token_id={token_id}")
        return {
            'success': True,
            'token_id': token_id,
            'tx_hash': f'0xdev_{territory.h3_index[:16]}',
            'mock': True,
            'error': None,
        }

    # Production — call smart contract
    try:
        from terra_domini.apps.blockchain.services import BlockchainService
        svc = BlockchainService.get()
        result = svc.mint_territory(
            to_address=player.wallet_address,
            h3_index=territory.h3_index,
            territory_name=territory.place_name or territory.h3_index,
        )
        logger.info(f"NFT minted: token_id={result['token_id']} tx={result['tx_hash']}")
        return {'success': True, **result, 'mock': False, 'error': None}
    except Exception as e:
        logger.error(f"NFT mint failed: {e}")
        return {'success': False, 'token_id': None, 'tx_hash': None, 'mock': False, 'error': str(e)}


def transfer_territory_nft(territory, from_player, to_player) -> dict:
    """Transfer NFT when territory changes hands (battle win)."""
    if not territory.token_id:
        return mint_territory_nft(territory, to_player)
    
    if not (from_player.wallet_address and to_player.wallet_address):
        logger.debug("Transfer skipped — missing wallets")
        return {'success': False, 'error': 'missing_wallets'}

    try:
        from terra_domini.apps.blockchain.services import BlockchainService
        svc = BlockchainService.get()
        tx = svc.transfer_territory(
            token_id=territory.token_id,
            from_address=from_player.wallet_address,
            to_address=to_player.wallet_address,
        )
        return {'success': True, 'tx_hash': tx, 'mock': False, 'error': None}
    except Exception as e:
        logger.error(f"NFT transfer failed: {e}")
        return {'success': False, 'error': str(e)}
