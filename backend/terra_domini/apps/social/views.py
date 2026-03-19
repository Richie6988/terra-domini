"""
Social views — re-exported from models_and_views.py for Django convention.
"""
from terra_domini.apps.social.models_and_views import (
    FriendViewSet,
    PublicProfileView,
    JoinViaReferralView,
)

__all__ = ['FriendViewSet', 'PublicProfileView', 'JoinViaReferralView']
