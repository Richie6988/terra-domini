# Idempotent (see terra_domini/utils/migration_ops.py). Wikipedia picture credit, history/news tokens (2026-10-18).
from django.db import migrations, models
from terra_domini.utils.migration_ops import AddFieldIfMissing


class Migration(migrations.Migration):

    dependencies = [("events", "0004_poi_governance")]

    operations = [
        AddFieldIfMissing(model_name="unifiedpoi", name="image_credit", field=models.CharField(blank=True, default="", max_length=300)),
        AddFieldIfMissing(model_name="unifiedpoi", name="event_date", field=models.CharField(blank=True, default="", max_length=10)),
        AddFieldIfMissing(model_name="unifiedpoi", name="expires_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AlterField(
            model_name='unifiedpoi',
            name='category',
            field=models.CharField(choices=[('mountain_peak', 'Mountain Peak'), ('volcano', 'Volcano'), ('canyon', 'Canyon'), ('waterfall', 'Waterfall'), ('glacier', 'Glacier'), ('cave_system', 'Cave System'), ('coral_reef', 'Coral Reef'), ('ancient_forest', 'Ancient Forest'), ('nature_sanctuary', 'Nature Sanctuary'), ('island', 'Strategic Island'), ('oil_field', 'Oil Field'), ('gas_reserve', 'Gas Reserve'), ('gold_mine', 'Gold Mine'), ('diamond_mine', 'Diamond Mine'), ('rare_earth', 'Rare Earth Deposit'), ('lithium_deposit', 'Lithium Deposit'), ('uranium_mine', 'Uranium Mine'), ('coal_mine', 'Coal Mine'), ('iron_ore', 'Iron Ore'), ('copper_mine', 'Copper Mine'), ('freshwater', 'Freshwater Reserve'), ('fertile_land', 'Fertile Land'), ('capital_city', 'Capital City'), ('mega_port', 'Mega Port'), ('chokepoint', 'Strategic Chokepoint'), ('nuclear_plant', 'Nuclear Plant'), ('space_center', 'Space Center'), ('data_center', 'Data Center Hub'), ('financial_hub', 'Financial Hub'), ('stock_exchange', 'Stock Exchange'), ('military_base', 'Military Base'), ('naval_base', 'Naval Base'), ('missile_site', 'Missile Site'), ('intelligence_hq', 'Intelligence HQ'), ('world_heritage', 'UNESCO World Heritage'), ('ancient_ruins', 'Ancient Ruins'), ('religious_site', 'Religious Site'), ('royal_palace', 'Royal Palace'), ('museum', 'Major Museum'), ('conspiracy', 'Conspiracy Site'), ('secret_facility', 'Secret Facility'), ('oligarch_asset', 'Oligarch Asset'), ('offshore_haven', 'Offshore Haven'), ('international_org', 'International Organization'), ('alliance_hq', 'Military Alliance HQ'), ('tech_giant', 'Tech Giant Campus'), ('media_hq', 'Media Headquarters'), ('control_tower', 'Control Tower'), ('trade_node', 'Trade Node'), ('ancient_wonder', 'Ancient Wonder'), ('anomaly', 'Anomaly Zone'), ('mega_dam', 'Mega Dam / Hydroelectric'), ('water_treatment', 'Water Treatment Plant'), ('desalination', 'Desalination Plant'), ('agri_megafarm', 'Mega Farm / Agricultural Hub'), ('seed_vault', 'Seed Vault'), ('steel_mill', 'Steel / Industrial Complex'), ('semiconductor', 'Semiconductor Fab'), ('pharma_hq', 'Pharmaceutical HQ'), ('internet_cable', 'Undersea Cable Landing'), ('ix_point', 'Internet Exchange Point'), ('sports_arena', 'Mega Sports Arena'), ('casino_resort', 'Casino / Resort Complex'), ('research_station', 'Research Station'), ('particle_collider', 'Particle Collider'), ('history_event', 'History Event'), ('news_event', 'News Event'), ('desert', 'Desert'), ('infrastructure', 'Infrastructure'), ('country', 'Country'), ('observatory', 'Major Observatory')], db_index=True, max_length=30),
        ),
    ]
