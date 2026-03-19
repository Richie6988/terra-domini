from rest_framework import serializers
from terra_domini.apps.economy.models import ShopItem

class ShopItemSerializer(serializers.ModelSerializer):
    is_available = serializers.SerializerMethodField()
    price_eur_display = serializers.SerializerMethodField()

    class Meta:
        model = ShopItem
        fields = ['id','code','name','description','category','price_tdc','price_eur',
                  'price_eur_display','effect_type','effect_value','effect_duration_seconds',
                  'max_per_day','hard_cap_pct','is_active','is_limited','available_until',
                  'icon_url','rarity','is_available']

    def get_is_available(self, obj):
        return obj.is_available()

    def get_price_eur_display(self, obj):
        return f"€{obj.price_eur:.2f}" if obj.price_eur else None
