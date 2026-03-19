"""
Terra Domini — URL routing.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerUIView

from terra_domini.apps.economy.views import (
    TerritoryViewSet, CombatViewSet, ShopViewSet, TDCViewSet,
    StripeWebhookView, AdCampaignViewSet
)
from terra_domini.apps.accounts.views import (
    RegisterView, LoginView, RefreshView, PlayerProfileView,
    LeaderboardView, PlayerSearchView, WalletLinkView
)
from terra_domini.apps.alliances.views import AllianceViewSet, DiplomacyViewSet
from terra_domini.apps.events.views import ControlTowerViewSet, EventViewSet
from terra_domini.apps.events.poi_views import WorldPOIViewSet
from terra_domini.apps.social.models_and_views import FriendViewSet, PublicProfileView, JoinViaReferralView

router = DefaultRouter()
router.register(r'territories', TerritoryViewSet, basename='territory')
router.register(r'combat', CombatViewSet, basename='combat')
router.register(r'shop', ShopViewSet, basename='shop')
router.register(r'tdc', TDCViewSet, basename='tdc')
router.register(r'alliances', AllianceViewSet, basename='alliance')
router.register(r'diplomacy', DiplomacyViewSet, basename='diplomacy')
router.register(r'events', EventViewSet, basename='event')
router.register(r'control-towers', ControlTowerViewSet, basename='control-tower')
router.register(r'ads', AdCampaignViewSet, basename='ad')
router.register(r'pois', WorldPOIViewSet, basename='poi')
router.register(r'social', FriendViewSet, basename='social')

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Health check (no auth)
    path('health/', lambda r: __import__('django.http', fromlist=['JsonResponse']).JsonResponse({'status': 'ok'})),

    # Auth endpoints (public)
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/auth/refresh/', RefreshView.as_view(), name='token_refresh'),

    # Player
    path('api/players/me/', PlayerProfileView.as_view(), name='player_profile'),
    path('api/players/search/', PlayerSearchView.as_view(), name='player_search'),
    path('api/players/wallet/', WalletLinkView.as_view(), name='wallet_link'),
    path('api/leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('api/players/<str:username>/profile/', PublicProfileView.as_view(), name='public_profile'),
    path('api/social/join-referral/', JoinViaReferralView.as_view(), name='join_referral'),

    # Game API (all require JWT)
    path('api/', include(router.urls)),

    # Stripe webhook (no JWT, signature-verified)
    path('webhooks/stripe/', StripeWebhookView.as_view(), name='stripe_webhook'),

    # API docs (dev only)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerUIView.as_view(url_name='schema'), name='swagger-ui'),
]
