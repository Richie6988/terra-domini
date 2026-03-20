"""
Terra Domini — Events App Initial Migration
Creates all tables: unified_poi, world_pois, resource_poi,
poi_player_interactions, poi_news_updates
"""
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    initial = True
    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        # ── UnifiedPOI ────────────────────────────────────────────────────
        migrations.CreateModel(
            name='UnifiedPOI',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('name', models.CharField(db_index=True, max_length=300)),
                ('category', models.CharField(db_index=True, max_length=30, default='anomaly')),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('country_code', models.CharField(blank=True, db_index=True, max_length=4)),
                ('country_name', models.CharField(blank=True, max_length=100)),
                ('h3_index', models.CharField(blank=True, db_index=True, max_length=20)),
                ('emoji', models.CharField(blank=True, max_length=8)),
                ('color', models.CharField(default='#6B7280', max_length=7)),
                ('size', models.CharField(default='md', max_length=4)),
                ('rarity', models.CharField(db_index=True, default='common', max_length=12)),
                ('game_resource', models.CharField(default='credits', max_length=20)),
                ('bonus_pct', models.IntegerField(default=25)),
                ('tdc_per_24h', models.DecimalField(decimal_places=2, default=10, max_digits=10)),
                ('description', models.TextField(blank=True)),
                ('real_output', models.CharField(blank=True, max_length=200)),
                ('wiki_url', models.URLField(blank=True)),
                ('fun_fact', models.TextField(blank=True)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('is_featured', models.BooleanField(default=False)),
                ('threat_level', models.CharField(default='none', max_length=10)),
                ('verified', models.BooleanField(default=True)),
                ('source', models.CharField(blank=True, max_length=50)),
                # NFT metadata
                ('mint_difficulty', models.IntegerField(default=1)),
                ('card_number', models.IntegerField(null=True, blank=True)),
                ('edition', models.CharField(max_length=20, default='genesis')),
                ('is_shiny', models.BooleanField(default=False)),
                ('floor_price_tdi', models.FloatField(default=0.0)),
                ('token_id', models.BigIntegerField(null=True, blank=True)),
                ('visitors_per_year', models.IntegerField(default=0)),
                ('geopolitical_score', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'unified_poi', 'ordering': ['-is_featured', '-bonus_pct', 'name']},
        ),
        migrations.AddIndex(
            model_name='unifiedpoi',
            index=models.Index(fields=['category', 'is_active'], name='poi_cat_idx'),
        ),
        migrations.AddIndex(
            model_name='unifiedpoi',
            index=models.Index(fields=['latitude', 'longitude'], name='poi_geo_idx'),
        ),
        migrations.AddIndex(
            model_name='unifiedpoi',
            index=models.Index(fields=['rarity', 'is_active'], name='poi_rar_idx'),
        ),
        migrations.AddIndex(
            model_name='unifiedpoi',
            index=models.Index(fields=['country_code'], name='poi_cc_idx'),
        ),

        # ── WorldPOI ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='WorldPOI',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('name', models.CharField(db_index=True, max_length=300)),
                ('poi_type', models.CharField(max_length=30, default='landmark')),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('country_code', models.CharField(blank=True, max_length=4)),
                ('emoji', models.CharField(blank=True, max_length=8)),
                ('color', models.CharField(default='#6B7280', max_length=7)),
                ('description', models.TextField(blank=True)),
                ('wiki_url', models.URLField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('is_featured', models.BooleanField(default=False)),
                ('threat_level', models.CharField(default='none', max_length=10)),
                ('rarity', models.CharField(default='common', max_length=12)),
                ('game_resource', models.CharField(default='credits', max_length=20)),
                ('bonus_pct', models.IntegerField(default=25)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'world_pois', 'ordering': ['-is_featured', '-threat_level', '-created_at']},
        ),

        # ── ResourcePOI ───────────────────────────────────────────────────
        migrations.CreateModel(
            name='ResourcePOI',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('name', models.CharField(db_index=True, max_length=300)),
                ('resource_type', models.CharField(max_length=30, default='energy')),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('country_code', models.CharField(blank=True, max_length=4)),
                ('emoji', models.CharField(blank=True, max_length=8)),
                ('color', models.CharField(default='#6B7280', max_length=7)),
                ('description', models.TextField(blank=True)),
                ('real_output', models.CharField(blank=True, max_length=200)),
                ('wiki_url', models.URLField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('is_featured', models.BooleanField(default=False)),
                ('rarity', models.CharField(default='common', max_length=12)),
                ('bonus_pct', models.IntegerField(default=25)),
                ('game_resource', models.CharField(default='energy', max_length=20)),
                ('source', models.CharField(blank=True, max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'resource_poi', 'ordering': ['-bonus_pct', 'name']},
        ),
        migrations.AddIndex(
            model_name='resourcepoi',
            index=models.Index(fields=['resource_type', 'is_active'], name='res_poi_type_idx'),
        ),
        migrations.AddIndex(
            model_name='resourcepoi',
            index=models.Index(fields=['latitude', 'longitude'], name='res_poi_geo_idx'),
        ),

        # ── POIPlayerInteraction ──────────────────────────────────────────
        migrations.CreateModel(
            name='POIPlayerInteraction',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('poi_id', models.UUIDField(db_index=True)),
                ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name='poi_interactions', to='auth.user')),
                ('interaction_type', models.CharField(max_length=20, default='view')),
                ('bonus_claimed', models.FloatField(default=0.0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'poi_player_interactions'},
        ),

        # ── POINewsUpdate ─────────────────────────────────────────────────
        migrations.CreateModel(
            name='POINewsUpdate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('poi_id', models.UUIDField(db_index=True)),
                ('title', models.CharField(max_length=300)),
                ('source', models.CharField(max_length=100, blank=True)),
                ('url', models.URLField(blank=True)),
                ('summary', models.TextField(blank=True)),
                ('event_type', models.CharField(max_length=30, default='news')),
                ('threat_delta', models.IntegerField(default=0)),
                ('published_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'poi_news_updates', 'ordering': ['-published_at']},
        ),
    ]
