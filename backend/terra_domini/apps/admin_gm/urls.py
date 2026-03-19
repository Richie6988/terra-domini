from django.urls import path
from terra_domini.apps.admin_gm.views import (
    GMDashboardView, GMPlayerListView, GMPlayerActionView,
    GMTowerView, GMPOIView, GMBroadcastView, GMEconomyView,
)

urlpatterns = [
    path('dashboard/',          GMDashboardView.as_view(),  name='gm_dashboard'),
    path('players/',            GMPlayerListView.as_view(), name='gm_players'),
    path('players/<str:player_id>/action/', GMPlayerActionView.as_view(), name='gm_player_action'),
    path('towers/',             GMTowerView.as_view(),      name='gm_towers'),
    path('towers/<str:event_id>/', GMTowerView.as_view(),   name='gm_tower_detail'),
    path('pois/',               GMPOIView.as_view(),        name='gm_pois'),
    path('broadcast/',          GMBroadcastView.as_view(),  name='gm_broadcast'),
    path('economy/',            GMEconomyView.as_view(),    name='gm_economy'),
]
