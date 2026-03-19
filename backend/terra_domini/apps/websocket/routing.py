from django.urls import re_path
from terra_domini.apps.websocket.consumers import TerritoryMapConsumer

websocket_urlpatterns = [
    re_path(r'^ws/map/$', TerritoryMapConsumer.as_asgi()),
]
