from django.urls import re_path
from terra_domini.apps.websocket.consumers import TerritoryMapConsumer
from terra_domini.apps.websocket.auction_consumer import AuctionChatConsumer

websocket_urlpatterns = [
    re_path(r'^ws/map/$', TerritoryMapConsumer.as_asgi()),
    re_path(r'^ws/auction/(?P<auction_id>\w+)/$', AuctionChatConsumer.as_asgi()),
]
