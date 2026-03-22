"""
Terra Domini — URL routing.
Clean version: no duplicate registrations, no duplicate health path.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView as SpectacularSwaggerUIView

from terra_domini.health import health_check, robots_txt
from terra_domini.apps.accounts.views import UpdateProfileView
from terra_domini.apps.accounts.geoip_view import GeoIPView
from terra_domini.frontend_view import FrontendAppView

# ─── Views imports ────────────────────────────────────────────────────────────
from terra_domini.apps.accounts.views import UpdateProfileView
from terra_domini.apps.accounts.views import (
    RegisterView, LoginView, RefreshView,
    PlayerProfileView, LeaderboardView, PlayerSearchView, WalletLinkView,
    PasswordResetRequestView, PasswordResetConfirmView,
)
from terra_domini.apps.territories.views import TerritoryViewSet
from terra_domini.apps.accounts.views import UpdateProfileView
from terra_domini.apps.accounts.views import PlayerViewSet
from terra_domini.apps.social.views import TradeViewSet
from terra_domini.apps.blockchain.wallet_views import WalletViewSet
from terra_domini.apps.territories.cluster_views import TerritoryClusterViewSet
from terra_domini.apps.progression.views import SkillTreeView, SkillUnlockView
from terra_domini.apps.progression.clicker_views import ClickerViewSet
from terra_domini.apps.progression.views import SkillTreeView, SkillUnlockView
from terra_domini.apps.progression.leaderboard_views import LeaderboardViewSet
from terra_domini.apps.events.resource_views import ResourcePOIViewSet
from terra_domini.apps.events.poi_views import UnifiedPOIViewSet
from terra_domini.apps.territories.trade_views import ResourceTradeViewSet

from terra_domini.apps.combat.views import BattleViewSet
from terra_domini.apps.economy.views import ShopViewSet, TDCViewSet, StripeWebhookView, AdCampaignViewSet
from terra_domini.apps.alliances.views import AllianceViewSet, DiplomacyViewSet
from terra_domini.apps.events.views import ControlTowerViewSet, EventViewSet
from terra_domini.apps.blockchain.marketplace_views import (
    MarketplaceListingsView, MarketplaceMyListingsView, MarketplaceListView,
    MarketplaceBuyView, MarketplaceDelistView, MarketplaceStatsView,
)
from terra_domini.apps.progression.views import SkillTreeView, SkillUnlockView
from terra_domini.apps.progression.views import ProgressionViewSet, TutorialCompleteView
from terra_domini.apps.social.views import FriendViewSet, PublicProfileView, JoinViaReferralView
from terra_domini.apps.social.models_and_views import MyReferralView

# ─── Router ───────────────────────────────────────────────────────────────────
router = DefaultRouter()
router.register(r'territories', TerritoryViewSet, basename='territory')
router.register(r'battles',     BattleViewSet,    basename='battle')
router.register(r'shop',        ShopViewSet,      basename='shop')
router.register(r'tdc',         TDCViewSet,       basename='tdc')
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
    path('robots.txt',  robots_txt),
    path('admin/',      admin.site.urls),

    # ── API Schema ──────────────────────────────────────────────────────────
    path('api/schema/',     SpectacularAPIView.as_view(),          name='schema'),
    path('api/docs/',       SpectacularSwaggerUIView.as_view(url_name='schema'), name='swagger-ui'),

    # ── Auth (no JWT required) ───────────────────────────────────────────────
    path('api/auth/register/', RegisterView.as_view(),    name='register'),
    path('api/auth/login/',    LoginView.as_view(),       name='login'),
    path('api/auth/refresh/',  RefreshView.as_view(),     name='token_refresh'),
    path('api/auth/password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('api/auth/password-reset-confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),

    # ── Player ───────────────────────────────────────────────────────────────
    path('api/players/me/',           PlayerProfileView.as_view(), name='player_me'),
    path('api/players/search/',       PlayerSearchView.as_view(),  name='player_search'),
    path('api/players/wallet/',       WalletLinkView.as_view(),    name='wallet_link'),
    path('api/leaderboard/',          LeaderboardView.as_view(),   name='leaderboard'),
    path('api/players/<str:username>/profile/', PublicProfileView.as_view(), name='public_profile'),

    # ── Blockchain / TDC ─────────────────────────────────────────────────────
    path('api/tdc/balance/',   TDCBalanceView.as_view(),   name='tdc_balance'),
    path('api/tdc/purchase/',  TDCPurchaseView.as_view(),  name='tdc_purchase'),
    path('api/tdc/withdraw/',  TDCWithdrawView.as_view(),  name='tdc_withdraw'),

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
    path('api/progression/skills/', SkillTreeView.as_view(), name='skill-tree'),
    path('api/progression/skills/<int:pk>/unlock/', SkillUnlockView.as_view(), name='skill-unlock'),
    path('api/progression/tutorial-complete/', TutorialCompleteView.as_view(), name='tutorial_complete'),

    # ── Social ────────────────────────────────────────────────────────────────
    path('api/social/join-referral/', JoinViaReferralView.as_view(), name='join_referral'),
    path('api/social/my-referral/',   MyReferralView.as_view(),      name='my_referral'),

    # ── Router (all ViewSets) ─────────────────────────────────────────────────
    path('api/', include(router.urls)),
    path('api/gm/', include('terra_domini.apps.admin_gm.urls')),

    # ── React SPA catch-all (must be LAST) ───────────────────────────────────
    # Any URL that doesn't match /api/ /admin/ /health/ /static/ /ws/
    # gets served the React app — React Router handles client-side routing
    re_path(r'^(?!api/|admin/|health/|static/|media/|ws/|robots[.]txt).*$',
            FrontendAppView.as_view(), name='frontend'),
]