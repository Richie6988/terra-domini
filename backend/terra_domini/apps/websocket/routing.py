from django.urls import re_path
from terra_domini.apps.websocket.consumers import TerritoryMapConsumer
from terra_domini.apps.websocket.auction_consumer import AuctionChatConsumer
from terra_domini.apps.websocket.alliance_consumer import AllianceChatConsumer

websocket_urlpatterns = [
    re_path(r'^ws/map/$', TerritoryMapConsumer.as_asgi()),
    re_path(r'^ws/auction/(?P<auction_id>\w+)/$', AuctionChatConsumer.as_asgi()),
    re_path(r'^ws/alliance/(?P<alliance_id>\w+)/$', AllianceChatConsumer.as_asgi()),
]
