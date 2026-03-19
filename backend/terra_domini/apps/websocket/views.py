"""
WebSocket views — minimal HTTP views for WS connection info.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class WebSocketInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'ws_url': f"ws://{request.get_host()}/ws/game/",
            'protocol': 'terra-domini-v1',
        })
