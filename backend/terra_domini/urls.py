"""
Terra Domini — URL routing.
Clean version: no duplicate registrations, no duplicate health path.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve as static_serve
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView as SpectacularSwaggerUIView

from terra_domini.health import health_check, robots_txt
from terra_domini.apps.accounts.views import UpdateProfileView
from terra_domini.apps.accounts.geoip_view import GeoIPView
from terra_domini.frontend_view import FrontendAppView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([AllowAny])
def news_ticker(request):
    """GET /api/news/ticker/ — game news feed. Serves admin ticker messages first."""
    # Try to get admin-managed ticker messages
    try:
        from terra_domini.apps.admin_gm.models import TickerMessage
        admin_msgs = list(TickerMessage.objects.filter(is_active=True).order_by('-created_at')[:10].values(
            'type', 'title', 'text'
        ))
        if admin_msgs:
            return Response(admin_msgs)
    except Exception:
        pass

    # Live real-world events on the map (apps/events/world_events.py), then the accurate basics
    items = []
    try:
        from django.utils import timezone as _tz
        from terra_domini.apps.events.news_models import NewsEvent
        now = _tz.now()
        for e in NewsEvent.objects.filter(starts_at__lte=now, ends_at__gt=now).exclude(h3_index='').order_by('-hex_reward')[:6]:
            items.append({'type': 'event', 'title': (e.event_kind or 'event').upper(),
                          'text': f'{e.headline[:90]} — hold {e.poi_name} to win {e.hex_reward} HEX'})
    except Exception:
        pass
    items += [
        {'type': 'update', 'title': 'HARVEST', 'text': 'Your stock fills for 8h — collect it 3 times a day or production is lost.'},
        {'type': 'alert',  'title': 'SAFARI',  'text': '5 hunts a day: real species hide around your land. Fill your album.'},
    ]
    return Response(items)

# Mail
from terra_domini.apps.mail.views import inbox as mail_inbox, mark_read as mail_mark_read

# ─── Views imports ────────────────────────────────────────────────────────────
from terra_domini.apps.accounts.views import UpdateProfileView
from terra_domini.apps.accounts.views import (
    RegisterView, LoginView, RefreshView,
    PlayerProfileView, LeaderboardView, PlayerSearchView, WalletLinkView,
    PasswordResetRequestView, PasswordResetConfirmView,
    VerifyEmailView, ResendVerificationView,
)
from terra_domini.apps.territories.views import TerritoryViewSet, SafariViewSet
from terra_domini.apps.accounts.views import UpdateProfileView
from terra_domini.apps.accounts.views import PlayerViewSet
from terra_domini.apps.accounts.views import FavoritePinsView, FavoritePinDetailView
from terra_domini.apps.accounts.views import NotificationsView
from terra_domini.apps.social.views import TradeViewSet
from terra_domini.apps.blockchain.wallet_views import WalletViewSet
from terra_domini.apps.blockchain.solana_views import (
    TokenomicsView, VerifyNFTOwnershipView, SPLTokenInfoView,
    TokenomicsWhitepaperView, OnChainRevenueView,
    StakingInfoView, StakeView, ClaimStakingRewardsView,
)
from terra_domini.apps.territories.cluster_views import TerritoryClusterViewSet
from terra_domini.apps.progression.views import SkillTreeView, SkillUnlockView
from terra_domini.apps.progression.clicker_views import ClickerViewSet
from terra_domini.apps.progression.views import SkillTreeView, SkillUnlockView
from terra_domini.apps.progression.leaderboard_views import LeaderboardViewSet
from terra_domini.apps.events.resource_views import ResourcePOIViewSet
from terra_domini.apps.events.poi_views import UnifiedPOIViewSet, map_pois
from terra_domini.apps.territories.trade_views import ResourceTradeViewSet

from terra_domini.apps.combat.views import BattleViewSet
from terra_domini.apps.economy.loop_views import loop_status, loop_collect, codex_cards, territory_card, satellite_tile, satellite_card
from terra_domini.apps.economy.payments import hex_packs, hex_checkout, hex_checkout_confirm
from terra_domini.apps.economy.auction_views import auctions_list, auction_bid
from terra_domini.apps.economy.lottery_views import lottery_status, lottery_play
from terra_domini.apps.economy.pickup_views import pickups_in_view, pickup_collect
from terra_domini.apps.economy.map_resources import map_states
from terra_domini.apps.events import card_market_views as event_cards
from terra_domini.apps.accounts.profile_views import profile_stats
from terra_domini.apps.territories.kingdom_views import kingdom_overview, kingdom_upgrade, daily_draft, my_regions
from terra_domini.apps.combat.recruitment import (
    my_army as combat_my_army,
    recruit as combat_recruit,
    collect_training as combat_collect,
    assign_to_kingdom as combat_assign,
    unassign_units as combat_unassign,
    upgrade_unit as combat_unit_upgrade,
)
from terra_domini.apps.economy.views import ShopViewSet, StripeWebhookView, AdCampaignViewSet
from terra_domini.apps.alliances.views import AllianceViewSet, DiplomacyViewSet
from terra_domini.apps.events.views import ControlTowerViewSet, EventViewSet
from terra_domini.apps.events.news_views import (
    list_news_events as news_events_list,
    register_for_event as news_event_register,
    my_event_results as news_my_results,
    resolve_events as news_resolve,
)
from terra_domini.apps.blockchain.marketplace_views import (
    MarketplaceListingsView, MarketplaceMyListingsView, MarketplaceListView,
    MarketplaceBuyView, MarketplaceDelistView, MarketplaceStatsView,
)
from terra_domini.apps.progression.views import SkillTreeView, SkillUnlockView
from terra_domini.apps.progression.views import ProgressionViewSet, TutorialCompleteView, offline_summary
from terra_domini.apps.social.views import FriendViewSet, PublicProfileView, JoinViaReferralView
from terra_domini.apps.social.models_and_views import MyReferralView

# ─── Router ───────────────────────────────────────────────────────────────────
router = DefaultRouter()
router.register(r'territories', TerritoryViewSet, basename='territory')
router.register(r'safari', SafariViewSet, basename='safari')
router.register(r'battles',     BattleViewSet,    basename='battle')
router.register(r'combat',      BattleViewSet,    basename='combat')
router.register(r'shop',        ShopViewSet,      basename='shop')
router.register(r'alliances',   AllianceViewSet,  basename='alliance')
router.register(r'diplomacy',   DiplomacyViewSet, basename='diplomacy')
router.register(r'events',      EventViewSet,     basename='event')
router.register(r'control-towers', ControlTowerViewSet, basename='control-tower')
router.register(r'ads',         AdCampaignViewSet, basename='ad')
router.register(r'social',      FriendViewSet,    basename='social')
router.register(r'progression', ProgressionViewSet, basename='progression')
router.register(r'players', PlayerViewSet, basename='players')
router.register(r'trade', TradeViewSet, basename='trade')
router.register(r'wallet',      WalletViewSet,           basename='wallet')
router.register(r'territories-geo', TerritoryClusterViewSet, basename='territories-geo')
router.register(r'clicker',     ClickerViewSet,          basename='clicker')
router.register(r'leaderboard', LeaderboardViewSet,      basename='leaderboard')
router.register(r'resources',   ResourcePOIViewSet,      basename='resources')
router.register(r'pois',        UnifiedPOIViewSet,       basename='pois')
router.register(r'resource-trade', ResourceTradeViewSet,   basename='resource-trade')


# ─── URL Patterns ─────────────────────────────────────────────────────────────
urlpatterns = [
    # ── System ──────────────────────────────────────────────────────────────
    path('health/',     health_check, name='health'),
    path('api/geoip/',   GeoIPView.as_view(), name='geoip'),
    path('api/news/ticker/', news_ticker, name='news_ticker'),

    # ── Military Recruitment ──────────────────────────────────────────
    path('api/loop/status/',   loop_status,   name='loop_status'),
    path('api/loop/collect/',  loop_collect,  name='loop_collect'),
    path('api/codex/cards/',   codex_cards,   name='codex_cards'),
    path('api/map/pois/',      map_pois,      name='map_pois'),
    path('api/map/states/',    map_states,    name='map_states'),
    path('api/shop/hex-packs/',             hex_packs,            name='hex_packs'),
    path('api/shop/hex-checkout/',          hex_checkout,         name='hex_checkout'),
    path('api/shop/hex-checkout/confirm/',  hex_checkout_confirm, name='hex_checkout_confirm'),
    path('api/codex/territory/<str:h3_index>/', territory_card, name='territory_card'),
    path('api/tiles/sat/<int:z>/<int:x>/<int:y>.jpg', satellite_tile, name='satellite_tile'),
    path('api/tiles/satcard/<str:h3_index>.jpg', satellite_card, name='satellite_card'),
    path('api/pickups/', pickups_in_view, name='pickups_in_view'),
    path('api/pickups/collect/', pickup_collect, name='pickup_collect'),
    path('api/lottery/', lottery_status, name='lottery_status'),
    path('api/lottery/play/', lottery_play, name='lottery_play'),
    path('api/auctions/', auctions_list, name='auctions_list'),
    path('api/auctions/<str:auction_id>/bid/', auction_bid, name='auction_bid'),
    path('api/players/me/profile-stats/',       profile_stats,      name='profile_stats'),
    path('api/event-cards/market/',              event_cards.market, name='event_cards_market'),
    path('api/event-cards/<uuid:card_id>/sell/',   event_cards.sell,   name='event_cards_sell'),
    path('api/event-cards/<uuid:card_id>/delist/', event_cards.delist, name='event_cards_delist'),
    path('api/event-cards/<uuid:card_id>/buy/',    event_cards.buy,    name='event_cards_buy'),
    path('api/regions/',         my_regions,       name='my_regions'),
    path('api/combat/draft/',    daily_draft,      name='combat_draft'),
    path('api/kingdom/<str:h3_index>/overview/', kingdom_overview, name='kingdom_overview'),
    path('api/kingdom/<str:h3_index>/upgrade/',  kingdom_upgrade,  name='kingdom_upgrade'),
    path('api/combat/my-army/',  combat_my_army,   name='combat_my_army'),
    path('api/combat/recruit/',  combat_recruit,   name='combat_recruit'),
    path('api/combat/collect/',  combat_collect,   name='combat_collect'),
    path('api/combat/assign/',   combat_assign,    name='combat_assign'),
    path('api/combat/unassign/', combat_unassign,  name='combat_unassign'),
    path('api/combat/unit-upgrade/', combat_unit_upgrade, name='combat_unit_upgrade'),

    # ── News Events (live news → geolocalized tokens) ─────────────────────
    path('api/events/news/', news_events_list, name='news_events_list'),
    path('api/events/news/<uuid:event_id>/register/', news_event_register, name='news_event_register'),
    path('api/events/news/my-results/', news_my_results, name='news_my_results'),
    path('api/events/news/resolve/', news_resolve, name='news_resolve'),
    path('robots.txt',  robots_txt),
    path('admin/',      admin.site.urls),

    # ── API Schema ──────────────────────────────────────────────────────────
    path('api/schema/',     SpectacularAPIView.as_view(),          name='schema'),
    path('api/docs/',       SpectacularSwaggerUIView.as_view(url_name='schema'), name='swagger-ui'),

    # ── Auth (no JWT required) ───────────────────────────────────────────────
    path('api/auth/register/', RegisterView.as_view(),    name='register'),
    path('api/auth/login/',    LoginView.as_view(),       name='login'),
    path('api/auth/refresh/',  RefreshView.as_view(),     name='token_refresh'),
    path('api/auth/verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    path('api/auth/resend-verification/', ResendVerificationView.as_view(), name='resend_verification'),
    path('api/auth/password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('api/auth/password-reset-confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),

    # ── Player ───────────────────────────────────────────────────────────────
    path('api/players/me/',           PlayerProfileView.as_view(), name='player_me'),
    path('api/players/search/',       PlayerSearchView.as_view(),  name='player_search'),
    path('api/players/wallet/',       WalletLinkView.as_view(),    name='wallet_link'),
    path('api/leaderboard/',          LeaderboardView.as_view(),   name='leaderboard'),
    path('api/players/<str:username>/profile/', PublicProfileView.as_view(), name='public_profile'),

    # ── Blockchain / TDC ─────────────────────────────────────────────────────

    # ── Marketplace NFT ──────────────────────────────────────────────────────
    path('api/marketplace/listings/',       MarketplaceListingsView.as_view(),   name='marketplace_listings'),
    path('api/marketplace/listings/mine/',  MarketplaceMyListingsView.as_view(), name='marketplace_mine'),
    path('api/marketplace/list/',           MarketplaceListView.as_view(),       name='marketplace_list'),
    path('api/marketplace/buy/',            MarketplaceBuyView.as_view(),        name='marketplace_buy'),
    path('api/marketplace/delist/',         MarketplaceDelistView.as_view(),     name='marketplace_delist'),
    path('api/marketplace/stats/',          MarketplaceStatsView.as_view(),      name='marketplace_stats'),

    # ── Stripe webhook (no JWT) ───────────────────────────────────────────────
    path('api/webhooks/stripe/', StripeWebhookView.as_view(), name='stripe_webhook'),

    # ── Progression ──────────────────────────────────────────────────────────
    path('api/players/update-profile/', UpdateProfileView.as_view(), name='update-profile'),
    path('api/players/pins/', FavoritePinsView.as_view(), name='player-pins'),
    path('api/players/pins/<int:pk>/', FavoritePinDetailView.as_view(), name='player-pin-detail'),
    path('api/notifications/', NotificationsView.as_view(), name='notifications'),
    path('api/notifications/mark-read/', NotificationsView.as_view(), name='notifications-mark-read'),
    path('api/progression/skills/', SkillTreeView.as_view(), name='skill-tree'),
    path('api/progression/skills/<int:pk>/unlock/', SkillUnlockView.as_view(), name='skill-unlock'),
    path('api/progression/tutorial-complete/', TutorialCompleteView.as_view(), name='tutorial_complete'),
    path('api/progression/offline-summary/',   offline_summary,                name='offline_summary'),

    # ── Social ────────────────────────────────────────────────────────────────
    path('api/social/join-referral/', JoinViaReferralView.as_view(), name='join_referral'),
    path('api/solana/tokenomics/',      TokenomicsView.as_view()),
    path('api/solana/verify-ownership/', VerifyNFTOwnershipView.as_view()),
    path('api/solana/spl-token/',        SPLTokenInfoView.as_view()),
    path('api/solana/tokenomics/whitepaper.pdf', TokenomicsWhitepaperView.as_view()),
    path('api/solana/revenue/',          OnChainRevenueView.as_view()),
    path('api/solana/staking/',          StakingInfoView.as_view()),
    path('api/solana/stake/',            StakeView.as_view()),
    path('api/solana/staking/action/',   StakeView.as_view()),  # alias pour StakingPanel
    path('api/solana/claim-rewards/',    ClaimStakingRewardsView.as_view()),

    # ── Mail ──
    path('api/mail/inbox/',          mail_inbox),
    path('api/mail/<int:pk>/read/',  mail_mark_read),
    path('api/social/my-referral/',   MyReferralView.as_view(),      name='my_referral'),

    # ── Router (all ViewSets) ─────────────────────────────────────────────────
    path('api/', include(router.urls)),
    path('api/gm/', include('terra_domini.apps.admin_gm.urls')),

    # ── React SPA catch-all (must be LAST) ───────────────────────────────────
    # Any URL that doesn't match /api/ /admin/ /health/ /static/ /ws/
    # gets served the React app — React Router handles client-side routing
    # Servir les assets Vite buildés (/assets/index-xxx.js etc.)
    re_path(r'^assets/(?P<path>.*)$', static_serve, {
        'document_root': str(settings.BASE_DIR.parent / 'frontend' / 'dist' / 'assets'),
    }),
        re_path(r'^(?!api/|admin/|health/|static/|assets/|media/|ws/|robots[.]txt).*$',
            FrontendAppView.as_view(), name='frontend'),
]