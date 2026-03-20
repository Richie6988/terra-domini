# Generated migration for unified_poi and related models
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='UnifiedPOI',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(db_index=True, max_length=300)),
                ('category', models.CharField(choices=[
                    ('mountain_peak','Mountain Peak'),('volcano','Volcano'),('canyon','Canyon'),
                    ('waterfall','Waterfall'),('glacier','Glacier'),('cave_system','Cave System'),
                    ('coral_reef','Coral Reef'),('ancient_forest','Ancient Forest'),
                    ('nature_sanctuary','Nature Sanctuary'),('island','Strategic Island'),
                    ('oil_field','Oil Field'),('gas_reserve','Gas Reserve'),('gold_mine','Gold Mine'),
                    ('diamond_mine','Diamond Mine'),('rare_earth','Rare Earth Deposit'),
                    ('lithium_deposit','Lithium Deposit'),('uranium_mine','Uranium Mine'),
                    ('coal_mine','Coal Mine'),('iron_ore','Iron Ore'),('copper_mine','Copper Mine'),
                    ('freshwater','Freshwater Reserve'),('fertile_land','Fertile Land'),
                    ('capital_city','Capital City'),('mega_port','Mega Port'),
                    ('chokepoint','Strategic Chokepoint'),('nuclear_plant','Nuclear Plant'),
                    ('space_center','Space Center'),('data_center','Data Center Hub'),
                    ('financial_hub','Financial Hub'),('stock_exchange','Stock Exchange'),
                    ('military_base','Military Base'),('naval_base','Naval Base'),
                    ('missile_site','Missile Site'),('intelligence_hq','Intelligence HQ'),
                    ('world_heritage','UNESCO World Heritage'),('ancient_ruins','Ancient Ruins'),
                    ('religious_site','Religious Site'),('royal_palace','Royal Palace'),
                    ('museum','Major Museum'),('conspiracy','Conspiracy Site'),
                    ('secret_facility','Secret Facility'),('oligarch_asset','Oligarch Asset'),
                    ('offshore_haven','Offshore Haven'),('international_org','International Organization'),
                    ('alliance_hq','Military Alliance HQ'),('tech_giant','Tech Giant Campus'),
                    ('media_hq','Media Headquarters'),('control_tower','Control Tower'),
                    ('trade_node','Trade Node'),('ancient_wonder','Ancient Wonder'),
                    ('anomaly','Anomaly Zone'),('mega_dam','Mega Dam / Hydroelectric'),
                    ('water_treatment','Water Treatment Plant'),('desalination','Desalination Plant'),
                    ('agri_megafarm','Mega Farm / Agricultural Hub'),('seed_vault','Seed Vault'),
                    ('steel_mill','Steel / Industrial Complex'),('semiconductor','Semiconductor Fab'),
                    ('pharma_hq','Pharmaceutical HQ'),('internet_cable','Undersea Cable Landing'),
                    ('ix_point','Internet Exchange Point'),('sports_arena','Mega Sports Arena'),
                    ('casino_resort','Casino / Resort Complex'),('research_station','Research Station'),
                    ('particle_collider','Particle Collider'),('observatory','Major Observatory'),
                ], db_index=True, max_length=30)),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('country_code', models.CharField(blank=True, db_index=True, max_length=4)),
                ('country_name', models.CharField(blank=True, max_length=100)),
                ('h3_index', models.CharField(blank=True, db_index=True, max_length=20)),
                ('emoji', models.CharField(blank=True, max_length=8)),
                ('color', models.CharField(default='#6B7280', max_length=7)),
                ('size', models.CharField(choices=[('xs','XS'),('sm','SM'),('md','MD'),('lg','LG'),('xl','XL')], default='md', max_length=4)),
                ('rarity', models.CharField(choices=[('common','Common'),('uncommon','Uncommon'),('rare','Rare'),('legendary','Legendary')], db_index=True, default='common', max_length=12)),
                ('game_resource', models.CharField(default='credits', max_length=20)),
                ('bonus_pct', models.IntegerField(default=25)),
                ('tdc_per_24h', models.DecimalField(decimal_places=2, default=10, max_digits=10)),
                ('description', models.TextField(blank=True)),
                ('real_output', models.CharField(blank=True, max_length=200)),
                ('wiki_url', models.URLField(blank=True)),
                ('fun_fact', models.TextField(blank=True)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('is_featured', models.BooleanField(default=False)),
                ('threat_level', models.CharField(choices=[('none','None'),('low','Low'),('medium','Medium'),('high','High'),('critical','Critical')], default='none', max_length=10)),
                ('verified', models.BooleanField(default=True)),
                ('source', models.CharField(blank=True, max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'unified_poi', 'ordering': ['-is_featured', '-bonus_pct', 'name']},
        ),
        migrations.AddIndex(
            model_name='unifiedpoi',
            index=models.Index(fields=['category', 'is_active'], name='unified_poi_cat_idx'),
        ),
        migrations.AddIndex(
            model_name='unifiedpoi',
            index=models.Index(fields=['latitude', 'longitude'], name='unified_poi_geo_idx'),
        ),
        migrations.AddIndex(
            model_name='unifiedpoi',
            index=models.Index(fields=['rarity', 'is_active'], name='unified_poi_rar_idx'),
        ),
    ]
