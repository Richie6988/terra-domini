"""
solana_views.py — Endpoints publics Solana/NFT
  GET  /api/solana/tokenomics/          — distribution schedule + burn méchanismes
  POST /api/solana/verify-ownership/    — vérifier propriété NFT on-chain
  GET  /api/solana/spl-token/           — infos token HEX SPL
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated


class TokenomicsView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        from terra_domini.apps.blockchain.solana_devnet import TOKENOMICS
        return Response(TOKENOMICS)


class VerifyNFTOwnershipView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        mint_address   = request.data.get('mint_address', '')
        wallet_address = request.data.get('wallet_address') or getattr(request.user, 'wallet_address', '')
        if not mint_address:
            return Response({'error': 'mint_address required'}, status=400)
        from terra_domini.apps.blockchain.solana_devnet import verify_nft_ownership
        owns = verify_nft_ownership(mint_address, wallet_address)
        return Response({'owns': owns, 'mint_address': mint_address, 'wallet': wallet_address})


class SPLTokenInfoView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        from terra_domini.apps.blockchain.solana_devnet import (
            HEX_TOKEN_NAME, HEX_TOKEN_SYMBOL, HEX_TOKEN_DECIMALS,
            HEX_TOKEN_SUPPLY, HEXOD_ENV, SOLANA_RPC, mock_create_spl_token,
        )
        info = mock_create_spl_token()
        info['network'] = 'devnet' if HEXOD_ENV != 'production' else 'mainnet'
        info['rpc'] = SOLANA_RPC
        return Response(info)


class StakingInfoView(APIView):
    """GET /api/solana/staking/ — positions + rewards du joueur."""
    permission_classes = [IsAuthenticated]
    def get(self, request):
        from django.db import connection
        import sqlite3, os
        db = str(__import__('django').conf.settings.DATABASES['default'].get('NAME','db.sqlite3'))
        conn = sqlite3.connect(db)
        c = conn.cursor()
        # Créer table si inexistante
        c.execute("""
            CREATE TABLE IF NOT EXISTS hex_staking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id TEXT NOT NULL, amount REAL NOT NULL,
                staked_at TEXT NOT NULL, daily_reward REAL NOT NULL,
                apr REAL NOT NULL
            )
        """)
        conn.commit()
        c.execute("SELECT amount, staked_at, daily_reward, apr FROM hex_staking WHERE player_id=?",
                  [str(request.user.id)])
        rows = c.fetchall()
        conn.close()
        total = sum(r[0] for r in rows)
        rewards = sum(r[2] for r in rows)  # stub: pending = 1 day reward
        return Response({
            'total_staked': total,
            'rewards_pending': round(rewards, 6),
            'positions': [{'amount': r[0], 'staked_at': r[1], 'daily_reward': r[2], 'apr': r[3]} for r in rows],
        })


class StakeView(APIView):
    """POST /api/solana/stake/ {amount}"""
    permission_classes = [IsAuthenticated]
    def post(self, request):
        amount = float(request.data.get('amount', 0))
        if amount < 100:
            return Response({'error': 'Minimum 100 HEX'}, status=400)
        balance = float(getattr(request.user, 'tdc_in_game', 0) or 0)
        if amount > balance:
            return Response({'error': 'Solde insuffisant'}, status=402)
        from terra_domini.apps.blockchain.solana_devnet import TOKENOMICS
        tiers = TOKENOMICS['staking_apr']
        apr = (8 if amount < 1000 else 12 if amount < 10000 else 18 if amount < 100000 else 25)
        daily = round(amount * apr / 100 / 365, 6)
        import sqlite3
        db = str(__import__('django').conf.settings.DATABASES['default'].get('NAME','db.sqlite3'))
        conn = sqlite3.connect(db)
        c = conn.cursor()
        c.execute("CREATE TABLE IF NOT EXISTS hex_staking (id INTEGER PRIMARY KEY AUTOINCREMENT, player_id TEXT, amount REAL, staked_at TEXT, daily_reward REAL, apr REAL)")
        c.execute("INSERT INTO hex_staking (player_id,amount,staked_at,daily_reward,apr) VALUES (?,?,datetime('now'),?,?)",
                  [str(request.user.id), amount, daily, apr])
        conn.commit(); conn.close()
        request.user.__class__.objects.filter(id=request.user.id).update(
            tdc_in_game=__import__('django').db.models.F('tdc_in_game') - amount
        )
        return Response({'ok': True, 'amount': amount, 'apr': apr, 'daily_reward': daily})


class ClaimStakingRewardsView(APIView):
    """POST /api/solana/claim-rewards/"""
    permission_classes = [IsAuthenticated]
    def post(self, request):
        import sqlite3
        db = str(__import__('django').conf.settings.DATABASES['default'].get('NAME','db.sqlite3'))
        conn = sqlite3.connect(db)
        c = conn.cursor()
        c.execute("SELECT SUM(daily_reward) FROM hex_staking WHERE player_id=?", [str(request.user.id)])
        total = c.fetchone()[0] or 0
        conn.close()
        if total <= 0:
            return Response({'error': 'Aucune récompense à réclamer'}, status=400)
        request.user.__class__.objects.filter(id=request.user.id).update(
            tdc_in_game=__import__('django').db.models.F('tdc_in_game') + total
        )
        return Response({'ok': True, 'claimed': round(total, 6)})
