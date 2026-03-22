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


class TokenomicsWhitepaperView(APIView):
    """
    GET /api/solana/tokenomics/whitepaper.pdf
    Génère un PDF du whitepaper tokenomics (Thomas spec).
    En dev: retourne le JSON comme fallback si reportlab absent.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from terra_domini.apps.blockchain.solana_devnet import TOKENOMICS
        fmt = request.query_params.get('format', 'pdf')

        if fmt == 'json':
            return Response(TOKENOMICS)

        try:
            return self._generate_pdf(TOKENOMICS)
        except ImportError:
            # reportlab non installé — retourner JSON avec header approprié
            from django.http import JsonResponse
            return JsonResponse(TOKENOMICS)

    def _generate_pdf(self, tok: dict):
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.colors import HexColor, black, white
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import cm
        from io import BytesIO
        from django.http import HttpResponse

        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
            leftMargin=2.5*cm, rightMargin=2.5*cm,
            topMargin=2.5*cm, bottomMargin=2.5*cm)

        styles = getSampleStyleSheet()
        gold   = HexColor('#F59E0B')
        dark   = HexColor('#050510')
        grey   = HexColor('#9CA3AF')

        title_style = ParagraphStyle('Title', parent=styles['Heading1'],
            fontSize=28, textColor=gold, spaceAfter=8, fontName='Helvetica-Bold')
        h2_style = ParagraphStyle('H2', parent=styles['Heading2'],
            fontSize=14, textColor=gold, spaceAfter=4, fontName='Helvetica-Bold')
        body_style = ParagraphStyle('Body', parent=styles['Normal'],
            fontSize=10, textColor=black, spaceAfter=4, leading=14)
        mono_style = ParagraphStyle('Mono', parent=styles['Normal'],
            fontSize=9, fontName='Courier', textColor=HexColor('#374151'))

        story = []

        # Titre
        story.append(Paragraph('⬡ HEXOD TOKEN', title_style))
        story.append(Paragraph('Whitepaper Tokenomics — Saison 1', h2_style))
        story.append(Paragraph('Version 0.1 · Confidentiel', mono_style))
        story.append(Spacer(1, 0.5*cm))

        # Summary
        story.append(Paragraph('Résumé exécutif', h2_style))
        story.append(Paragraph(
            f"Le token HEX est le token utilitaire natif d'Hexod, le premier jeu de stratégie géopolitique "
            f"sur carte mondiale réelle avec des territoires NFT sur Solana. Supply totale : "
            f"{tok['total_supply']:,} HEX · {tok['decimals']} décimales.",
            body_style))
        story.append(Spacer(1, 0.3*cm))

        # Distribution
        story.append(Paragraph('Distribution des tokens', h2_style))
        dist_data = [['Allocation', 'Pourcentage', 'Montant']]
        labels = {
            'play_to_earn':   'Play to Earn',
            'team_vesting':   'Équipe (4 ans vesting)',
            'treasury':       'Trésorerie',
            'ecosystem_fund': 'Fonds Écosystème',
            'sale_private':   'Tour privé',
            'sale_public':    'IDO Public',
            'liquidity':      'Liquidité DEX',
            'advisors':       'Advisors',
        }
        for k, v in tok['distribution'].items():
            amount = int(tok['total_supply'] * v)
            dist_data.append([labels.get(k, k), f"{v*100:.0f}%", f"{amount:,} HEX"])

        dist_table = Table(dist_data, colWidths=[7*cm, 3*cm, 5*cm])
        dist_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), gold),
            ('TEXTCOLOR',  (0,0), (-1,0), white),
            ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',   (0,0), (-1,-1), 9),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#F9FAFB'), white]),
            ('GRID', (0,0), (-1,-1), 0.5, HexColor('#E5E7EB')),
            ('PADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(dist_table)
        story.append(Spacer(1, 0.4*cm))

        # Staking APR
        story.append(Paragraph('Staking APR', h2_style))
        stk_data = [['Tier', 'Montant staké', 'APR', 'Bonus gameplay']]
        bonuses = ['Production +5%', 'Production +10% · DEF +5%',
                   'Production +18% · DEF +10%', 'Production +25% · DAO vote']
        for i, (k, apr) in enumerate(tok['staking_apr'].items()):
            tier = k.replace('tier_','T').replace('_',' → ')
            stk_data.append([f"Tier {i+1}", tier.split('_')[-1] + '+ HEX', f"{apr*100:.0f}%", bonuses[i]])

        stk_table = Table(stk_data, colWidths=[2*cm, 4*cm, 2*cm, 7*cm])
        stk_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), gold),
            ('TEXTCOLOR',  (0,0), (-1,0), white),
            ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',   (0,0), (-1,-1), 8),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#F9FAFB'), white]),
            ('GRID', (0,0), (-1,-1), 0.5, HexColor('#E5E7EB')),
            ('PADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(stk_table)
        story.append(Spacer(1, 0.4*cm))

        # Mécanismes de burn
        story.append(Paragraph('Mécanismes de Burn (déflationnaires)', h2_style))
        for burn in tok['burn_mechanisms']:
            story.append(Paragraph(f"• {burn}", body_style))
        story.append(Spacer(1, 0.4*cm))

        # Disclaimer
        story.append(Paragraph('Avertissement', h2_style))
        story.append(Paragraph(
            "Ce document est fourni à titre informatif uniquement et ne constitue pas une offre de valeurs mobilières. "
            "Les informations contenues sont susceptibles d'être modifiées. "
            "Hexod est un projet en développement actif — version beta.",
            ParagraphStyle('Disc', parent=body_style, fontSize=8, textColor=grey)))

        doc.build(story)
        buf.seek(0)
        response = HttpResponse(buf.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="hexod-tokenomics.pdf"'
        return response


class OnChainRevenueView(APIView):
    """
    GET /api/solana/revenue/
    Dashboard revenus on-chain : volume marketplace 7j, fees, burns (Thomas spec).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        import sqlite3 as _sq
        from django.conf import settings as _s
        from datetime import timedelta
        from django.utils import timezone

        db = str(_s.DATABASES['default'].get('NAME','db.sqlite3'))
        conn = _sq.connect(db); c = conn.cursor()

        # Volume marketplace 7j
        try:
            c.execute("""
                SELECT SUM(price_hex), COUNT(*)
                FROM nft_listings
                WHERE status='sold' AND updated_at > datetime('now','-7 days')
            """)
            row = c.fetchone()
            vol7d, sales7d = (row[0] or 0), (row[1] or 0)
        except: vol7d, sales7d = 0, 0

        # Fees collectées (5% royalties sur marketplace)
        fees7d = vol7d * 0.05

        # Tokens brûlés (estimé depuis les NFT upgrades + enchères)
        try:
            c.execute("SELECT COUNT(*) FROM territories WHERE nft_version > 1")
            upgrades = c.fetchone()[0] or 0
        except: upgrades = 0

        tokens_burned = upgrades * 50  # 5% × ~1000 HEX moyen par upgrade

        conn.close()

        return Response({
            'marketplace_volume_7d': round(vol7d, 2),
            'sales_count_7d':        sales7d,
            'fees_collected_7d':     round(fees7d, 2),
            'tokens_burned_total':   tokens_burned,
            'staking_tvl':           0,   # TODO: somme des stakes
            'network':               'devnet',
            'last_updated':          timezone.now().isoformat(),
        })
