"""
In-Game World Events — 6-Month Calendar
========================================
12 scheduled events designed to:
1. Create recurring viral TikTok moments
2. Drive re-engagement at predictable intervals
3. Reward active players during event windows
4. Generate press angles for each launch week

Each event has:
- In-game effects (resource multipliers, special units, missions)
- TikTok content angle
- Press hook
- Player incentive structure

Schedule (from launch day):
  Week 1  : Hormuz Crisis LIVE (already active)
  Week 3  : Operation Spring Thaw — EU alliance mega-war
  Week 5  : Control Tower Season 1 — prize pool
  Week 7  : TDC Market Surge Event
  Week 9  : World Cup Qualifier POIs (stadium landmarks)
  Week 10 : Operation Silent Storm — stealth mechanics
  Week 12 : Space Race — Starbase TX launch event
  Week 14 : Silk Road Revival — trade route bonus week
  Week 16 : G20 Emergency Summit POI
  Week 18 : Season 1 Finale — leaderboard reset + grand prizes
  Week 20 : Season 2 Launch + new continent unlock
  Week 24 : 6-month anniversary mega-event
"""
import uuid
from datetime import datetime, timedelta, timezone as dt_tz
from django.utils import timezone


# ─── Event definitions ───────────────────────────────────────────────────────

WORLD_EVENTS_CALENDAR = [

    # ── EVENT 1: HORMUZ CRISIS (already active) ──
    {
        'slug': 'hormuz-crisis-2026',
        'name': '🔥 Strait of Hormuz — Active Blockade',
        'type': 'geopolitical_crisis',
        'status': 'active',
        'week': 0,  # already live
        'duration_days': 60,  # ongoing
        'regions_affected': ['IR', 'AE', 'SA', 'KW', 'IQ', 'QA', 'OM', 'BH'],
        'radius_km': 800,
        'effects': {
            'resource_multipliers': {'energy': 0.4, 'credits': 0.65, 'intel': 3.0, 'materials': 0.55},
            'military_modifier': 1.8,
            'special_unit_unlock': 'naval',
            'mission_bonus': 'intel',
            'tdc_market_impact_pct': 18,
        },
        'tiktok_angle': 'Le vrai Détroit d\'Ormuz bloqué → énergie qui baisse dans le jeu',
        'press_hook': 'Premier jeu au monde à simuler la crise Hormuz en temps réel',
        'player_incentive': '3× intel TDC · Naval units unlocked · Diplomacy missions available',
        'total_reward_pool_tdc': 50000,
    },

    # ── EVENT 2: OPERATION SPRING THAW ──
    {
        'slug': 'operation-spring-thaw',
        'name': '❄️ Operation Spring Thaw — EU Alliance Mega-War',
        'type': 'scheduled_alliance_war',
        'status': 'scheduled',
        'week': 3,
        'duration_days': 7,
        'regions_affected': ['FR', 'DE', 'ES', 'IT', 'PL', 'UK', 'NL', 'BE'],
        'radius_km': 5000,
        'effects': {
            'alliance_war_bonus': 2.0,       # 2× war score during event
            'territory_capture_bonus': 1.5,  # 50% more resources on capture
            'defense_debuff': 0.7,           # weaker defenses — more dynamic map
            'special_unit_unlock': 'elite_infantry',
        },
        'mechanics': {
            'event_type': 'continental_war',
            'scoring': 'territories_controlled_at_end',
            'winner_prize': 'Top 3 alliances share 100,000 TDC prize pool',
            'individual_prize': 'Top 100 players get exclusive Spring Thaw banner',
        },
        'tiktok_angle': '500 joueurs ont attaqué toute l\'Europe en même temps — time-lapse',
        'press_hook': 'Le plus grand événement de guerre virtuel sur carte réelle',
        'player_incentive': '100k TDC prize pool · Exclusive cosmetic · Leaderboard glory',
        'total_reward_pool_tdc': 100000,
    },

    # ── EVENT 3: CONTROL TOWER SEASON 1 ──
    {
        'slug': 'control-tower-season-1',
        'name': '🗼 Control Tower Wars — Season 1 Championship',
        'type': 'seasonal_championship',
        'status': 'scheduled',
        'week': 5,
        'duration_days': 14,
        'regions_affected': ['ALL'],
        'radius_km': None,  # global
        'effects': {
            'tower_capture_reward_multiplier': 3.0,
            'tower_event_frequency': 4,  # 4 events/day instead of 3
            'spectator_mode_enabled': True,
            'tdc_prize_pool_bonus': True,
        },
        'mechanics': {
            'format': '500 towers globally contested, 3 capture windows/day',
            'scoring': 'cumulative tower-hours controlled',
            'prize_tiers': {
                'Global #1 Alliance': '250,000 TDC',
                'Global #2-5': '50,000 TDC each',
                'Top 50 individuals': 'Season 1 Trophy NFT + 5,000 TDC',
                'Participation': '100 TDC + Season 1 badge',
            },
        },
        'tiktok_angle': 'Live Control Tower battle — 1h countdown — winner takes 50k TDC',
        'press_hook': 'Premiere d\'un esport géostratégique avec vrai prize money crypto',
        'player_incentive': '250k TDC top prize · Trophy NFT · Season leaderboard',
        'total_reward_pool_tdc': 500000,
    },

    # ── EVENT 4: TDC MARKET SURGE ──
    {
        'slug': 'tdc-market-surge-week-7',
        'name': '🚀 TDC Market Surge — Double Earning Week',
        'type': 'economy_event',
        'status': 'scheduled',
        'week': 7,
        'duration_days': 7,
        'regions_affected': ['ALL'],
        'radius_km': None,
        'effects': {
            'ad_revenue_multiplier': 2.0,    # 2× ad revenue all territories
            'resource_production_bonus': 1.3,
            'tdc_purchase_bonus_pct': 20,    # +20% TDC on any purchase
            'withdrawal_fee_waived': True,   # 0% withdrawal fee this week
        },
        'tiktok_angle': 'Cette semaine j\'ai gagné 2× mes revenus pub normaux — voici le proof',
        'press_hook': 'Terra Domini double tous les revenus des joueurs pendant 7 jours',
        'player_incentive': '2× TDC from ads · Free withdrawals · +20% on purchases',
        'total_reward_pool_tdc': 200000,
    },

    # ── EVENT 5: WORLD CUP QUALIFIERS ──
    {
        'slug': 'world-cup-qualifiers-2027',
        'name': '⚽ World Cup 2027 Qualifiers — Stadium Battles',
        'type': 'cultural_event',
        'status': 'scheduled',
        'week': 9,
        'duration_days': 10,
        'regions_affected': ['ALL'],
        'radius_km': 5,  # stadium-level precision
        'special_pois': [
            {'name': 'Stade de France', 'lat': 48.9244, 'lon': 2.3601, 'country': 'FR'},
            {'name': 'Wembley Stadium', 'lat': 51.5560, 'lon': -0.2796, 'country': 'GB'},
            {'name': 'Camp Nou', 'lat': 41.3809, 'lon': 2.1228, 'country': 'ES'},
            {'name': 'Allianz Arena', 'lat': 48.2188, 'lon': 11.6247, 'country': 'DE'},
            {'name': 'San Siro', 'lat': 45.4784, 'lon': 9.1240, 'country': 'IT'},
            {'name': 'Maracanã', 'lat': -22.9121, 'lon': -43.2302, 'country': 'BR'},
        ],
        'effects': {
            'stadium_hex_culture_bonus': 5.0,   # 5× culture on stadium territories
            'stadium_hex_ad_revenue': 3.0,      # 3× ad revenue on stadiums
            'special_cosmetic': 'football_kit_territory_skin',
        },
        'mechanics': {
            'challenge': 'Control your national stadium hex during the qualifier match',
            'reward': 'National champion banner + 10,000 TDC per match won',
        },
        'tiktok_angle': 'J\'ai capturé le Stade de France pendant France-Allemagne',
        'press_hook': 'Football + géostratégie : le premier jeu qui lie les stades aux matchs réels',
        'total_reward_pool_tdc': 150000,
    },

    # ── EVENT 6: OPERATION SILENT STORM ──
    {
        'slug': 'operation-silent-storm',
        'name': '🌪️ Operation Silent Storm — Stealth Week',
        'type': 'special_mechanics',
        'status': 'scheduled',
        'week': 10,
        'duration_days': 5,
        'regions_affected': ['ALL'],
        'radius_km': None,
        'effects': {
            'attack_timer_hidden': True,      # attackers invisible on map
            'intel_unit_bonus': 3.0,
            'espionage_missions_unlocked': True,
            'surprise_attack_damage_bonus': 1.5,
        },
        'tiktok_angle': 'Cette semaine les attaques sont invisibles — personne sait qu\'il se fait attaquer',
        'press_hook': 'Première mécanique d\'espionnage invisible dans un .io géo-stratégique',
        'total_reward_pool_tdc': 75000,
    },

    # ── EVENT 7: SPACE RACE ──
    {
        'slug': 'spacex-starship-launch-event',
        'name': '🚀 Space Race — Starship S30 Launch Window',
        'type': 'real_world_trigger',
        'status': 'scheduled',
        'week': 12,
        'duration_days': 3,
        'trigger': 'SpaceX Starship launch from Boca Chica, TX',
        'regions_affected': ['US', 'TX'],
        'radius_km': 300,
        'effects': {
            'resource_multipliers': {'materials': 3.0, 'intel': 2.0},
            'tech_surge': True,
            'special_unit': 'drone_swarm',
        },
        'tiktok_angle': 'Le lancement SpaceX de ce soir déclenche un event dans ce jeu — en direct',
        'press_hook': 'Terra Domini synchronise ses world events avec les vrais lancements spatiaux',
        'total_reward_pool_tdc': 50000,
    },

    # ── EVENT 8: SILK ROAD REVIVAL ──
    {
        'slug': 'silk-road-revival',
        'name': '🐪 Silk Road Revival — Trade Route Bonus Week',
        'type': 'economy_event',
        'status': 'scheduled',
        'week': 14,
        'duration_days': 7,
        'corridor': [
            {'lat': 39.9042, 'lon': 116.4074, 'name': 'Beijing'},
            {'lat': 41.2995, 'lon': 69.2401, 'name': 'Tashkent'},
            {'lat': 35.6892, 'lon': 51.3890, 'name': 'Tehran'},
            {'lat': 41.0082, 'lon': 28.9784, 'name': 'Istanbul'},
            {'lat': 48.8566, 'lon': 2.3522, 'name': 'Paris'},
        ],
        'effects': {
            'trade_route_income_multiplier': 4.0,
            'territories_on_corridor_bonus': 2.5,
            'diplomatic_events_boost': True,
        },
        'tiktok_angle': 'Les joueurs qui contrôlent la route de la soie gagnent 4× plus cette semaine',
        'press_hook': 'La route commerciale historique du monde recréée en jeu en temps réel',
        'total_reward_pool_tdc': 80000,
    },

    # ── EVENT 9: G20 EMERGENCY SUMMIT ──
    {
        'slug': 'g20-emergency-summit-2027',
        'name': '🌐 G20 Emergency Summit — Energy Crisis Diplomacy',
        'type': 'geopolitical_event',
        'status': 'scheduled',
        'week': 16,
        'duration_days': 5,
        'location': {'lat': 35.6762, 'lon': 139.6503, 'name': 'Tokyo'},
        'effects': {
            'global_energy_stability_bonus': 1.5,    # partial Hormuz recovery
            'diplomatic_mission_rewards': 3.0,
            'alliance_treasury_interest': 1.2,
        },
        'tiktok_angle': 'Le G20 de Tokyo se tient dans le jeu — les diplomates peuvent gagner de la crypto',
        'press_hook': 'Les sommets G20 ont maintenant un jumeau numérique dans Terra Domini',
        'total_reward_pool_tdc': 60000,
    },

    # ── EVENT 10: SEASON 1 FINALE ──
    {
        'slug': 'season-1-finale',
        'name': '🏆 Season 1 Finale — The Grand Reckoning',
        'type': 'season_end',
        'status': 'scheduled',
        'week': 18,
        'duration_days': 7,
        'effects': {
            'season_score_multiplier': 2.0,
            'all_bonuses_active': True,
            'leaderboard_snapshot': True,
            'season_cosmetics_last_chance': True,
        },
        'mechanics': {
            'leaderboard_reset': True,
            'prizes': {
                'Global rank 1': '1,000,000 TDC + Legendary Commander skin',
                'Top 10': '100,000 TDC + Epic skin',
                'Top 100': '10,000 TDC + Rare skin',
                'Top 1000': '1,000 TDC + Season 1 badge',
                'Participation': '100 TDC',
            },
        },
        'tiktok_angle': 'J\'ai fini #4 mondial · voici mon chemin pour la saison 2',
        'press_hook': 'Plus grand prize pool d\'un jeu browser : 1M TDC pour le rank 1',
        'total_reward_pool_tdc': 2000000,
    },

    # ── EVENT 11: SEASON 2 LAUNCH ──
    {
        'slug': 'season-2-launch-apac',
        'name': '🌏 Season 2 — Asia Pacific Unlocked',
        'type': 'content_expansion',
        'status': 'scheduled',
        'week': 20,
        'duration_days': 14,
        'new_content': {
            'new_regions': ['JP', 'KR', 'CN', 'SG', 'TH', 'VN', 'AU', 'IN'],
            'new_poi_count': 80,
            'new_unit': 'cyber_division',
            'new_mechanic': 'monsoon_season',  # seasonal resource changes
        },
        'tiktok_angle': 'L\'Asie vient d\'être ajoutée — course pour prendre Tokyo',
        'press_hook': 'Terra Domini dépasse 1 milliard d\'hexagones jouables avec l\'APAC',
        'total_reward_pool_tdc': 500000,
    },

    # ── EVENT 12: 6-MONTH ANNIVERSARY ──
    {
        'slug': '6-month-anniversary',
        'name': '🎉 6-Month Anniversary — The Great Reset',
        'type': 'anniversary',
        'status': 'scheduled',
        'week': 24,
        'duration_days': 7,
        'effects': {
            'all_resource_multiplier': 3.0,
            'daily_spin_legendary_rate': 0.20,  # 20% legendary (vs 3% normal)
            'free_battle_pass_for_all': True,
            'free_tdc_gift': 500,  # 500 TDC for every active player
        },
        'tiktok_angle': '6 mois · 100k joueurs · on donne 500 TDC à tout le monde ce weekend',
        'press_hook': '6 mois après le lancement : Terra Domini atteint 100k joueurs actifs',
        'total_reward_pool_tdc': 5000000,
    },
]


# ─── Event management functions ───────────────────────────────────────────────

def get_events_for_week(launch_date: datetime, target_week: int) -> list:
    """Return all events scheduled for a given week after launch."""
    return [e for e in WORLD_EVENTS_CALENDAR if e.get('week') == target_week]


def get_active_events(launch_date: datetime) -> list:
    """Return all currently active events based on launch date."""
    now = timezone.now()
    active = []
    for event in WORLD_EVENTS_CALENDAR:
        if event['status'] == 'active':
            active.append(event)
            continue
        if event['status'] == 'scheduled':
            event_start = launch_date + timedelta(weeks=event['week'])
            event_end = event_start + timedelta(days=event.get('duration_days', 7))
            if event_start <= now <= event_end:
                active.append({**event, 'status': 'active'})
    return active


def get_upcoming_events(launch_date: datetime, limit: int = 3) -> list:
    """Return the next N upcoming events."""
    now = timezone.now()
    upcoming = []
    for event in sorted(WORLD_EVENTS_CALENDAR, key=lambda e: e.get('week', 0)):
        if event['status'] == 'active':
            continue
        event_start = launch_date + timedelta(weeks=event['week'])
        if event_start > now:
            upcoming.append({
                **event,
                'starts_at': event_start.isoformat(),
                'days_until': (event_start - now).days,
            })
        if len(upcoming) >= limit:
            break
    return upcoming


def seed_events_to_db(launch_date: datetime = None):
    """
    Seed all world events into the database.
    Call after `python manage.py migrate` to populate the events calendar.
    """
    from terra_domini.apps.events.models import WorldEvent

    if launch_date is None:
        launch_date = timezone.now()

    created = 0
    for event_def in WORLD_EVENTS_CALENDAR:
        week = event_def.get('week', 0)
        starts_at = launch_date + timedelta(weeks=week)
        ends_at = starts_at + timedelta(days=event_def.get('duration_days', 7))

        obj, was_created = WorldEvent.objects.get_or_create(
            name=event_def['name'],
            defaults={
                'description': event_def.get('press_hook', ''),
                'event_type': event_def['type'],
                'is_global': 'ALL' in event_def.get('regions_affected', []),
                'affected_countries': event_def.get('regions_affected', []),
                'effects': event_def.get('effects', {}),
                'starts_at': starts_at,
                'ends_at': ends_at,
                'is_active': event_def.get('status') == 'active',
            }
        )
        if was_created:
            created += 1

    return {'created': created, 'total': len(WORLD_EVENTS_CALENDAR)}


# ─── TikTok content helper ────────────────────────────────────────────────────

def get_tiktok_post_for_event(event_slug: str) -> dict:
    """Get the TikTok content brief for a given event."""
    event = next((e for e in WORLD_EVENTS_CALENDAR if e.get('slug') == event_slug), None)
    if not event:
        return {}

    return {
        'hook': event.get('tiktok_angle', ''),
        'press_angle': event.get('press_hook', ''),
        'player_cta': event.get('player_incentive', ''),
        'prize_pool': f"{event.get('total_reward_pool_tdc', 0):,} TDC",
        'hashtags': f"#terradomiini #{event['slug'].replace('-', '')} #gaming #crypto",
        'recommended_post_time': '19:00 CET Friday',
        'content_type': 'announcement_teaser',
    }
