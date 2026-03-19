"""
Social app models — re-exports from models_and_views.py for Django compatibility.
Django requires models.py to exist in each app for migrations.
"""
from terra_domini.apps.social.models_and_views import (
    Friendship,
    FriendRequest,
    ReferralLink,
    Referral,
)

__all__ = ['Friendship', 'FriendRequest', 'ReferralLink', 'Referral']
