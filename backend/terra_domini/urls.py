"""
Terra Domini — URL routing.
Clean version: no duplicate registrations, no duplicate health path.
"""
from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView as SpectacularSwaggerUIView

from terra_domini.health import health_check, robots_txt
from terra_domini.apps.accounts.geoip_view import GeoIPView
from terra_domini.frontend_view import FrontendAppView

# ─── Views imports ────────────────────────────────────────────────────────────
from terra_domini.apps.accounts.views import (
    RegisterView, LoginView, RefreshView,
    PlayerProfileView, LeaderboardView, PlayerSearchView, WalletLinkView,
    PasswordResetRequestView, PasswordResetConfirmView,
)
from terra_domini.apps.territories.views import TerritoryViewSet
from terra_domini.apps.combat.views import BattleViewSet
from terra_domini.apps.economy.views import ShopViewSet, TDCViewSet, StripeWebhookView, AdCampaignViewSet
from terra_domini.apps.alliances.views import AllianceViewSet, DiplomacyViewSet
from terra_domini.apps.events.views import ControlTowerViewSet, EventViewSet
from terra_domini.apps.events.poi_views import WorldPOIViewSet
from terra_domini.apps.blockchain.views import TDCBalanceView, TDCPurchaseView, TDCWithdrawView
from terra_domini.apps.progression.views import ProgressionViewSet, TutorialCompleteView
from terra_domini.apps.social.views import FriendViewSet, PublicProfileView, JoinViaReferralView

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
router.register(r'pois',        WorldPOIViewSet,  basename='poi')
router.register(r'social',      FriendViewSet,    basename='social')
router.register(r'progression', ProgressionViewSet, basename='progression')

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

    # ── Stripe webhook (no JWT) ───────────────────────────────────────────────
    path('api/webhooks/stripe/', StripeWebhookView.as_view(), name='stripe_webhook'),

    # ── Progression ──────────────────────────────────────────────────────────
    path('api/progression/tutorial-complete/', TutorialCompleteView.as_view(), name='tutorial_complete'),

    # ── Social ────────────────────────────────────────────────────────────────
    path('api/social/join-referral/', JoinViaReferralView.as_view(), name='join_referral'),

    # ── Router (all ViewSets) ─────────────────────────────────────────────────
    path('api/', include(router.urls)),
    path('api/gm/', include('terra_domini.apps.admin_gm.urls')),

    # ── React SPA catch-all (must be LAST) ───────────────────────────────────
    # Any URL that doesn't match /api/ /admin/ /health/ /static/ /ws/
    # gets served the React app — React Router handles client-side routing
    re_path(r'^(?!api/|admin/|health/|static/|media/|ws/|robots[.]txt).*$',
            FrontendAppView.as_view(), name='frontend'),
]