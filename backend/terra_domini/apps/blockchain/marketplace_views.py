"""
marketplace_views.py — Hexod NFT Marketplace MVP

Endpoints:
  GET  /api/marketplace/listings/        → toutes les annonces actives
  GET  /api/marketplace/listings/mine/   → mes annonces
  POST /api/marketplace/list/            → mettre en vente { h3_index, price_hex }
  POST /api/marketplace/buy/             → acheter { listing_id }
  POST /api/marketplace/delist/         → retirer une annonce { listing_id }

Tokenomics:
  - Royalties 5% → trésorerie Hexod (CDC §3.5)
  - Paiement en HEX Coin (tdc_in_game) pour V0, HEX token en V1
  - Vendeur reçoit 95% du prix
"""
import uuid
import logging
from django.db import connection, transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

logger = logging.getLogger('terra_domini.marketplace')

ROYALTY_PCT = 0.05   # 5% CDC §3.5
TREASURY_ID = 'hexod_treasury'  # pseudo-account for royalties


def _ensure_listings_table():
    with connection.cursor() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS nft_listings (
                id TEXT PRIMARY KEY,
                seller_id TEXT NOT NULL,
                seller_username TEXT NOT NULL,
                h3_index TEXT NOT NULL,
                token_id TEXT,
                rarity TEXT DEFAULT 'common',
                biome TEXT DEFAULT 'rural',
                poi_name TEXT DEFAULT '',
                is_shiny INTEGER DEFAULT 0,
                price_hex_coin REAL NOT NULL,
                status TEXT DEFAULT 'active',
                buyer_id TEXT,
                buyer_username TEXT,
                listed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sold_at DATETIME,
                nft_version INTEGER DEFAULT 1
            )
        """)
        # index for fast active listings
        c.execute("CREATE INDEX IF NOT EXISTS idx_nft_listings_status ON nft_listings(status)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_nft_listings_rarity ON nft_listings(rarity, status)")


_ensure_listings_table()

RARITY_ORDER = {'common': 0, 'uncommon': 1, 'rare': 2, 'epic': 3, 'legendary': 4, 'mythic': 5}


class MarketplaceListingsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """GET /api/marketplace/listings/ — active listings with filters"""
        rarity  = request.query_params.get('rarity')
        biome   = request.query_params.get('biome')
        min_p   = request.query_params.get('min_price')
        max_p   = request.query_params.get('max_price')
        shiny   = request.query_params.get('shiny')
        sort    = request.query_params.get('sort', 'recent')  # recent|price_asc|price_desc|rarity
        limit   = min(int(request.query_params.get('limit', 50)), 200)

        sql = "SELECT * FROM nft_listings WHERE status='active'"
        params = []
        if rarity: sql += " AND rarity=?"; params.append(rarity)
        if biome:  sql += " AND biome=?";  params.append(biome)
        if min_p:  sql += " AND price_hex_coin>=?"; params.append(float(min_p))
        if max_p:  sql += " AND price_hex_coin<=?"; params.append(float(max_p))
        if shiny == '1': sql += " AND is_shiny=1"

        order = {
            'price_asc':  'ORDER BY price_hex_coin ASC',
            'price_desc': 'ORDER BY price_hex_coin DESC',
            'rarity':     'ORDER BY is_shiny DESC, price_hex_coin DESC',
            'recent':     'ORDER BY listed_at DESC',
        }.get(sort, 'ORDER BY listed_at DESC')
        sql += f" {order} LIMIT ?"
        params.append(limit)

        with connection.cursor() as c:
            c.execute(sql, params)
            cols = [d[0] for d in c.description]
            rows = [dict(zip(cols, r)) for r in c.fetchall()]

        # Inject rarity_rank for frontend sorting
        for row in rows:
            row['rarity_rank'] = RARITY_ORDER.get(row.get('rarity', 'common'), 0)
            row['is_shiny'] = bool(row.get('is_shiny', 0))

        # Stats
        with connection.cursor() as c:
            c.execute("SELECT COUNT(*), MIN(price_hex_coin), MAX(price_hex_coin), AVG(price_hex_coin) FROM nft_listings WHERE status='active'")
            stats = c.fetchone()

        return Response({
            'listings': rows,
            'count': len(rows),
            'stats': {
                'total': stats[0] or 0,
                'min_price': stats[1],
                'max_price': stats[2],
                'avg_price': round(stats[3], 1) if stats[3] else None,
            }
        })


class MarketplaceMyListingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """GET /api/marketplace/listings/mine/ — seller's listings"""
        with connection.cursor() as c:
            c.execute("""
                SELECT * FROM nft_listings
                WHERE seller_id=?
                ORDER BY listed_at DESC LIMIT 100
            """, [str(request.user.id)])
            cols = [d[0] for d in c.description]
            rows = [dict(zip(cols, r)) for r in c.fetchall()]

        for row in rows:
            row['is_shiny'] = bool(row.get('is_shiny', 0))

        active = [r for r in rows if r['status'] == 'active']
        sold   = [r for r in rows if r['status'] == 'sold']

        return Response({
            'active': active, 'sold': sold,
            'active_count': len(active), 'sold_count': len(sold),
            'total_earned': sum(r['price_hex_coin'] * (1 - ROYALTY_PCT) for r in sold),
        })


class MarketplaceListView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """POST /api/marketplace/list/ { h3_index, price_hex_coin }"""
        h3_index = request.data.get('h3_index', '').strip()
        try:
            price = float(request.data.get('price_hex_coin', 0))
        except (TypeError, ValueError):
            return Response({'error': 'prix invalide'}, status=400)

        if not h3_index:
            return Response({'error': 'h3_index requis'}, status=400)
        if price <= 0:
            return Response({'error': 'Le prix doit être > 0'}, status=400)

        # Verify ownership
        from terra_domini.apps.territories.models import Territory
        try:
            t = Territory.objects.get(h3_index=h3_index, owner=request.user)
        except Territory.DoesNotExist:
            return Response({'error': 'Territoire introuvable ou non possédé'}, status=404)

        if not t.token_id and not t.nft_version:
            return Response({'error': 'Ce territoire n\'a pas encore été minté'}, status=400)

        # Check no active listing already
        with connection.cursor() as c:
            c.execute("SELECT id FROM nft_listings WHERE h3_index=? AND status='active'", [h3_index])
            if c.fetchone():
                return Response({'error': 'Ce territoire est déjà en vente'}, status=400)

        listing_id = str(uuid.uuid4())
        now = timezone.now().isoformat()

        with connection.cursor() as c:
            c.execute("""
                INSERT INTO nft_listings
                (id, seller_id, seller_username, h3_index, token_id, rarity, biome,
                 poi_name, is_shiny, price_hex_coin, status, listed_at, nft_version)
                VALUES (?,?,?,?,?,?,?,?,?,?,'active',?,?)
            """, [
                listing_id,
                str(request.user.id),
                request.user.username,
                h3_index,
                str(t.token_id or ''),
                t.rarity or 'common',
                t.territory_type or 'rural',
                t.poi_name or t.landmark_name or '',
                1 if t.is_shiny else 0,
                price, now,
                t.nft_version or 1,
            ])

        logger.info(f"Listed: {h3_index} by {request.user.username} at {price} HEX Coin")
        return Response({
            'success': True,
            'listing_id': listing_id,
            'price': price,
            'royalty_pct': ROYALTY_PCT * 100,
            'seller_receives': round(price * (1 - ROYALTY_PCT), 2),
        }, status=201)


class MarketplaceBuyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """POST /api/marketplace/buy/ { listing_id }"""
        listing_id = request.data.get('listing_id', '').strip()
        if not listing_id:
            return Response({'error': 'listing_id requis'}, status=400)

        with transaction.atomic():
            with connection.cursor() as c:
                c.execute("SELECT * FROM nft_listings WHERE id=? AND status='active'", [listing_id])
                row = c.fetchone()
                if not row:
                    return Response({'error': 'Annonce introuvable ou expirée'}, status=404)
                cols = [d[0] for d in c.description]
                listing = dict(zip(cols, row))

            if listing['seller_id'] == str(request.user.id):
                return Response({'error': 'Vous ne pouvez pas acheter votre propre annonce'}, status=400)

            price = float(listing['price_hex_coin'])
            h3_index = listing['h3_index']

            # Check buyer balance
            from terra_domini.apps.accounts.models import Player
            buyer = Player.objects.select_for_update().get(id=request.user.id)
            if float(buyer.tdc_in_game) < price:
                return Response({
                    'error': f'Solde insuffisant : {price} HEX Coin requis, vous avez {float(buyer.tdc_in_game):.0f}'
                }, status=402)

            # Verify territory still belongs to seller
            from terra_domini.apps.territories.models import Territory
            try:
                territory = Territory.objects.select_for_update().get(
                    h3_index=h3_index, owner_id=listing['seller_id']
                )
            except Territory.DoesNotExist:
                return Response({'error': 'Le territoire a changé de propriétaire'}, status=409)

            # Calculate splits: 95% seller, 5% royalty
            seller_share  = round(price * (1 - ROYALTY_PCT), 4)
            royalty_share = round(price * ROYALTY_PCT, 4)

            # Deduct from buyer
            Player.objects.filter(id=buyer.id).update(
                tdc_in_game=float(buyer.tdc_in_game) - price
            )
            # Credit seller
            Player.objects.filter(id=listing['seller_id']).update(
                tdc_in_game=Player.objects.get(id=listing['seller_id']).tdc_in_game + seller_share
            )
            # Transfer territory ownership
            territory.owner = buyer
            territory.captured_at = timezone.now()
            territory.save(update_fields=['owner', 'captured_at'])

            # Update listing
            now = timezone.now().isoformat()
            with connection.cursor() as c:
                c.execute("""
                    UPDATE nft_listings
                    SET status='sold', buyer_id=?, buyer_username=?, sold_at=?
                    WHERE id=?
                """, [str(buyer.id), buyer.username, now, listing_id])

        logger.info(
            f"Sale: {h3_index} · {price} HEX Coin · "
            f"{listing['seller_username']} → {buyer.username} · royalty {royalty_share}"
        )

        return Response({
            'success': True,
            'h3_index': h3_index,
            'price_paid': price,
            'seller': listing['seller_username'],
            'royalty_paid': royalty_share,
            'message': f'Territoire acquis ! {h3_index[:8]}… est à vous.',
        })


class MarketplaceDelistView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """POST /api/marketplace/delist/ { listing_id }"""
        listing_id = request.data.get('listing_id', '').strip()
        if not listing_id:
            return Response({'error': 'listing_id requis'}, status=400)

        with connection.cursor() as c:
            c.execute(
                "UPDATE nft_listings SET status='cancelled' WHERE id=? AND seller_id=? AND status='active'",
                [listing_id, str(request.user.id)]
            )
            affected = c.rowcount

        if not affected:
            return Response({'error': 'Annonce introuvable ou non annulable'}, status=404)

        return Response({'success': True})


class MarketplaceStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """GET /api/marketplace/stats/ — global marketplace stats"""
        with connection.cursor() as c:
            c.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE status='active') as active_count,
                    COUNT(*) FILTER (WHERE status='sold')   as sold_count,
                    SUM(price_hex_coin) FILTER (WHERE status='sold') as total_volume,
                    AVG(price_hex_coin) FILTER (WHERE status='active') as avg_list_price
                FROM nft_listings
            """)
            row = c.fetchone()
            # SQLite doesn't support FILTER — fallback
            if row is None or row[0] is None:
                c.execute("SELECT COUNT(*) FROM nft_listings WHERE status='active'")
                active = c.fetchone()[0]
                c.execute("SELECT COUNT(*), SUM(price_hex_coin) FROM nft_listings WHERE status='sold'")
                sr = c.fetchone()
                sold, vol = sr[0], sr[1] or 0
                c.execute("SELECT AVG(price_hex_coin) FROM nft_listings WHERE status='active'")
                avg_p = c.fetchone()[0]
            else:
                active, sold, vol, avg_p = row

        return Response({
            'active_listings': active or 0,
            'total_sold': sold or 0,
            'total_volume_hex_coin': round(float(vol or 0), 2),
            'avg_list_price': round(float(avg_p or 0), 2),
            'royalty_pct': ROYALTY_PCT * 100,
        })
