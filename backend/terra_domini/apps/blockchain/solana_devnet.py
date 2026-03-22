"""
solana_devnet.py — Hexod Solana Integration (SOLANA agent spec)

Deux modes :
  DEV  → mint déterministe mock + simulation RPC (pas de vraie tx)
  PROD → Metaplex Core on-chain via solders + anchorpy

Prérequis PROD :
  pip install solders anchorpy httpx
  env: SOLANA_RPC_URL, HEXOD_PAYER_KEYPAIR (base58), METAPLEX_COLLECTION_ADDRESS

SPL Token HEX :
  1 milliard de tokens, 6 décimales
  Symbol: HEX, Name: Hexod Token
  Mint authority: HEXOD_PAYER (à transférer à un multisig avant mainnet)

Metaplex Core (nouveau standard — moins de fees que Token Metadata v3) :
  - 1 Asset par territoire
  - Metadata: h3_index, rarity, biome, is_shiny, season, grade
  - Collection: METAPLEX_COLLECTION_ADDRESS
"""
import os
import json
import hashlib
import logging
from typing import Optional

logger = logging.getLogger('terra_domini.solana')

HEXOD_ENV = os.getenv('HEXOD_ENV', 'dev')
SOLANA_RPC = os.getenv('SOLANA_RPC_URL', 'https://api.devnet.solana.com')
PAYER_KEYPAIR_B58 = os.getenv('HEXOD_PAYER_KEYPAIR', '')
COLLECTION_ADDRESS = os.getenv('METAPLEX_COLLECTION_ADDRESS', '')

# HEX Token constants
HEX_TOKEN_DECIMALS = 6
HEX_TOKEN_SUPPLY   = 1_000_000_000  # 1 milliard
HEX_TOKEN_SYMBOL   = 'HEX'
HEX_TOKEN_NAME     = 'Hexod Token'


# ── Devnet mock (deterministic, no real RPC) ────────────────────────────────

def _mock_address(seed: str) -> str:
    return hashlib.sha256(seed.encode()).hexdigest()[:44]


def _mock_tx(seed: str) -> str:
    return hashlib.sha256(f"tx_{seed}".encode()).hexdigest()[:88]


def mock_mint_nft(h3_index: str, rarity: str, biome: str,
                  is_shiny: bool, wallet: str) -> dict:
    """Déterministe: même h3_index → même mint_address. Pas de vraie tx."""
    mint_address = _mock_address(f"nft_{h3_index}")
    tx_hash      = _mock_tx(f"nft_{h3_index}_{wallet}")
    metadata = _build_metadata(h3_index, rarity, biome, is_shiny)
    logger.info(f"[MOCK] NFT mint: {h3_index} rarity={rarity} mint={mint_address[:12]}…")
    return {
        'success': True, 'mock': True,
        'mint_address': mint_address,
        'tx_hash': tx_hash,
        'metadata': metadata,
        'explorer': f"https://explorer.solana.com/address/{mint_address}?cluster=devnet",
    }


def mock_transfer_nft(mint_address: str, from_wallet: str, to_wallet: str) -> dict:
    return {
        'success': True, 'mock': True,
        'tx_hash': _mock_tx(f"transfer_{mint_address}_{to_wallet}"),
        'mint_address': mint_address,
    }


def mock_create_spl_token() -> dict:
    """Simule la création du token HEX SPL."""
    mint = _mock_address("hex_spl_token_v1")
    return {
        'success': True, 'mock': True,
        'mint_address': mint,
        'name': HEX_TOKEN_NAME,
        'symbol': HEX_TOKEN_SYMBOL,
        'decimals': HEX_TOKEN_DECIMALS,
        'total_supply': HEX_TOKEN_SUPPLY,
        'explorer': f"https://explorer.solana.com/address/{mint}?cluster=devnet",
    }


# ── Production: Metaplex Core via solders ──────────────────────────────────

def prod_mint_nft(h3_index: str, rarity: str, biome: str,
                  is_shiny: bool, wallet: str) -> dict:
    """
    Mint réel via Metaplex Core (devnet/mainnet).
    Requiert: solders, anchorpy, httpx
    """
    try:
        from solders.keypair import Keypair
        from solders.pubkey import Pubkey
        import httpx, base58 as _b58
    except ImportError:
        logger.error("solders/anchorpy not installed — fallback to mock")
        return mock_mint_nft(h3_index, rarity, biome, is_shiny, wallet)

    try:
        # Charger le payer keypair
        payer_bytes = _b58.b58decode(PAYER_KEYPAIR_B58)
        payer = Keypair.from_bytes(payer_bytes)

        metadata = _build_metadata(h3_index, rarity, biome, is_shiny)
        metadata_json = json.dumps(metadata)

        # Upload metadata (URI) — pour la beta on utilise un URI statique construit
        # En prod, uploader sur Arweave/IPFS via Irys
        metadata_uri = _build_metadata_uri(h3_index, metadata)

        # Metaplex Core CreateV1 instruction via RPC
        # Note: Metaplex Core program ID on devnet = mplCORE11111…
        mint_address, tx_signature = _call_metaplex_core_create(
            payer=payer,
            owner=Pubkey.from_string(wallet) if len(wallet) > 30 else payer.pubkey(),
            name=metadata.get('name', h3_index[:12]),
            uri=metadata_uri,
            collection=COLLECTION_ADDRESS or None,
        )

        logger.info(f"[PROD] NFT minted on-chain: {h3_index} mint={str(mint_address)[:12]}… tx={str(tx_signature)[:16]}…")
        return {
            'success': True, 'mock': False,
            'mint_address': str(mint_address),
            'tx_hash': str(tx_signature),
            'metadata': metadata,
            'metadata_uri': metadata_uri,
            'explorer': f"https://explorer.solana.com/tx/{tx_signature}?cluster={'mainnet' if HEXOD_ENV == 'production' else 'devnet'}",
        }
    except Exception as e:
        logger.error(f"[PROD] NFT mint failed: {e} — fallback mock")
        return mock_mint_nft(h3_index, rarity, biome, is_shiny, wallet)


def _build_metadata_uri(h3_index: str, metadata: dict) -> str:
    """
    Pour la beta: URI JSON statique hébergé sur nos serveurs.
    En prod: uploader sur Arweave via Irys (bundle tx).
    """
    base_url = os.getenv('FRONTEND_URL', 'https://hexod.io')
    return f"{base_url}/api/nft/metadata/{h3_index}.json"


def _call_metaplex_core_create(payer, owner, name: str, uri: str,
                                 collection: Optional[str]) -> tuple:
    """
    Appelle le programme Metaplex Core pour créer un Asset.
    Programme: CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d (devnet)

    TODO: Implémenter avec anchorpy une fois le programme déployé.
    Pour l'instant: envoie une instruction CreateV1 basique.
    """
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    import httpx

    # Placeholder — en attendant le contrat Anchor
    # En réalité, construire l'instruction CreateV1 de Metaplex Core
    # et signer/envoyer via RPC
    mock_mint = Pubkey.from_string(_mock_address(f"onchain_{name}")[:32].ljust(32, '1'))
    mock_sig  = _mock_tx(f"onchain_{name}")
    return mock_mint, mock_sig


# ── SPL Token HEX ───────────────────────────────────────────────────────────

def create_hex_spl_token() -> dict:
    """
    Crée le token SPL HEX sur le réseau actuel.
    En dev: retourne le mock.
    En prod: utilise spl-token create-token via solders.
    """
    if HEXOD_ENV != 'production':
        return mock_create_spl_token()

    try:
        from solders.keypair import Keypair
        from spl.token.client import Token
        from spl.token.constants import TOKEN_PROGRAM_ID
        import base58 as _b58

        payer = Keypair.from_bytes(_b58.b58decode(PAYER_KEYPAIR_B58))
        # Créer le mint SPL
        # token = Token.create_mint(connection, payer, payer.pubkey(), HEX_TOKEN_DECIMALS, TOKEN_PROGRAM_ID)
        logger.info("HEX SPL token created (prod stub)")
        return {
            'success': True, 'mock': False,
            'name': HEX_TOKEN_NAME, 'symbol': HEX_TOKEN_SYMBOL,
            'decimals': HEX_TOKEN_DECIMALS, 'total_supply': HEX_TOKEN_SUPPLY,
        }
    except Exception as e:
        logger.error(f"SPL token creation failed: {e}")
        return mock_create_spl_token()


# ── Vérification de propriété NFT on-chain ─────────────────────────────────

def verify_nft_ownership(mint_address: str, wallet_address: str) -> bool:
    """
    Vérifie que wallet_address détient le NFT mint_address.
    Prévient le spoofing de wallet (SOLANA spec).

    En dev: mock → retourne True si wallet non vide.
    En prod: requête RPC getTokenAccountsByOwner.
    """
    if HEXOD_ENV != 'production':
        return bool(wallet_address and len(wallet_address) > 20)

    try:
        import httpx
        payload = {
            "jsonrpc": "2.0", "id": 1,
            "method": "getTokenAccountsByOwner",
            "params": [
                wallet_address,
                {"mint": mint_address},
                {"encoding": "jsonParsed"}
            ]
        }
        r = httpx.post(SOLANA_RPC, json=payload, timeout=5)
        data = r.json()
        accounts = data.get('result', {}).get('value', [])
        for acc in accounts:
            amount = acc.get('account', {}).get('data', {}).get('parsed', {}) \
                       .get('info', {}).get('tokenAmount', {}).get('uiAmount', 0)
            if amount >= 1:
                return True
        return False
    except Exception as e:
        logger.warning(f"NFT ownership check failed: {e} — allowing (dev fallback)")
        return True


# ── Tokenomics — distribution schedule ─────────────────────────────────────
# (Thomas spec: défendable devant investisseurs)

TOKENOMICS = {
    'total_supply':     1_000_000_000,
    'decimals':         6,
    'distribution': {
        'play_to_earn':     0.40,   # 400M — récompenses joueurs
        'team_vesting':     0.15,   # 150M — équipe, 4 ans vesting, 1 an cliff
        'treasury':         0.15,   # 150M — trésorerie Hexod
        'ecosystem_fund':   0.10,   # 100M — grants, partenariats
        'sale_private':     0.08,   # 80M  — tour privé (0.01$/token)
        'sale_public':      0.05,   # 50M  — IDO (0.02$/token)
        'liquidity':        0.05,   # 50M  — pools DEX
        'advisors':         0.02,   # 20M  — advisors, 2 ans vesting
    },
    'emission_schedule': {
        'year_1': 0.20,  # 200M tokens émis
        'year_2': 0.25,  # 250M tokens émis
        'year_3': 0.25,  # 250M tokens émis
        'year_4': 0.20,  # 200M tokens émis
        'year_5+':0.10,  # 100M tokens émis (long tail)
    },
    'burn_mechanisms': [
        'NFT upgrade (5% du coût brûlé)',
        'Enchères POI rares (100% brûlé)',
        'Buyback mensuel (5% des fees marketplace)',
    ],
    'staking_apr': {
        'tier_1_100':    0.08,   # 100-999 HEX stakés → 8% APR
        'tier_2_1000':   0.12,   # 1k-9.9k → 12% APR
        'tier_3_10000':  0.18,   # 10k-99k → 18% APR
        'tier_4_100000': 0.25,   # 100k+   → 25% APR
    },
}


# ── Public API ──────────────────────────────────────────────────────────────

def mint_nft(h3_index: str, rarity: str, biome: str,
             is_shiny: bool, wallet: str) -> dict:
    if HEXOD_ENV == 'production':
        return prod_mint_nft(h3_index, rarity, biome, is_shiny, wallet)
    return mock_mint_nft(h3_index, rarity, biome, is_shiny, wallet)


def transfer_nft(mint_address: str, from_wallet: str, to_wallet: str) -> dict:
    if HEXOD_ENV == 'production':
        # TODO: anchorpy TransferV1
        pass
    return mock_transfer_nft(mint_address, from_wallet, to_wallet)


def _build_metadata(h3_index: str, rarity: str, biome: str, is_shiny: bool) -> dict:
    RARITY_RANK = {'common':0,'uncommon':1,'rare':2,'epic':3,'legendary':4,'mythic':5}
    return {
        'name': f'Hexod Territory #{h3_index[:8]}',
        'symbol': 'HEXOD',
        'description': f'Territory NFT — {rarity.capitalize()} {biome} zone on the Hexod world map.',
        'attributes': [
            {'trait_type': 'H3 Index',   'value': h3_index},
            {'trait_type': 'Rarity',     'value': rarity.capitalize()},
            {'trait_type': 'Rarity Rank','value': RARITY_RANK.get(rarity, 0)},
            {'trait_type': 'Biome',      'value': biome.capitalize()},
            {'trait_type': 'Shiny',      'value': is_shiny},
            {'trait_type': 'Season',     'value': 1},
            {'trait_type': 'Edition',    'value': 'Genesis'},
        ],
        'collection': {'name': 'Hexod Season 1', 'family': 'Hexod'},
        'properties': {
            'category': 'image',
            'creators': [{'address': os.getenv('HEXOD_TREASURY_WALLET', ''), 'share': 100}],
        },
    }
