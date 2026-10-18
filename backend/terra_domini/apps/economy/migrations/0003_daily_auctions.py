# Idempotent (see terra_domini/utils/migration_ops.py). Daily auctions on rare place cards (2026-10-18).
import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from terra_domini.utils.migration_ops import CreateModelIfMissing


class Migration(migrations.Migration):

    dependencies = [
        ("economy", "0002_playerresource"),
        ("territories", "0005_measured_terrain"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        CreateModelIfMissing(
            name="DailyAuction",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("starts_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField(db_index=True)),
                ("start_price", models.IntegerField()),
                ("current_bid", models.IntegerField(default=0)),
                ("bid_count", models.IntegerField(default=0)),
                ("status", models.CharField(db_index=True, default="live", max_length=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("territory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="auctions", to="territories.territory")),
                ("top_bidder", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="auctions_leading", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "daily_auctions", "ordering": ["ends_at"]},
        ),
        CreateModelIfMissing(
            name="AuctionBid",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("amount", models.IntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("auction", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="bids", to="economy.dailyauction")),
                ("player", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="auction_bids", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "auction_bids", "ordering": ["-created_at"]},
        ),
    ]
