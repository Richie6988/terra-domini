"""
World Events Calendar — 6 months of programmed events for launch.
These drive engagement, TikTok content, and viral loops.

Each event:
1. Ties to real-world geopolitics (TikTok angle built-in)
2. Changes gameplay mechanics (reason to log in)
3. Creates shareable moments (share cards, screenshots)
4. Has a specific TikTok hook pre-written
"""
from datetime import datetime, timedelta, timezone
from terra_domini.apps.events.poi_models import WorldPOI, POINewsUpdate

EVENTS_CALENDAR = [

    # ─── LIVE NOW (Week 1) ───────────────────────────────────────────────────
    {
        "slug": "hormuz-blockade-2026",
        "name": "🔥 Hormuz Blockade — LIVE",
        "category": "conflict_zone",
        "threat": "critical",
        "start": "2026-03-19",
        "end": None,  # ongoing
        "lat": 26.5819, "lon": 56.4242, "radius_km": 800,
        "effects": {
            "resource_multipliers": {"energy": 0.40, "credits": 0.65, "intel": 3.0},
            "military_modifier": 1.8,
            "special_unit_unlock": "naval",
            "trade_route_disrupted": True,
        },
        "tiktok_hook": "Ce jeu est au courant de la guerre en Iran 🤯",
        "tiktok_caption": "Le détroit d'Ormuz est bloqué IRL → ton énergie chute de 60% dans le jeu. Le seul jeu qui fait ça.",
        "ingame_news": "Iran closes Strait of Hormuz — 20% of world oil blocked. Energy production drops 60% across Gulf. Naval units unlocked.",
        "viral_potential": "EXTREMELY HIGH — event is trending globally right now",
    },

    # ─── Week 2 ───────────────────────────────────────────────────────────────
    {
        "slug": "oil-shock-global-2026",
        "name": "📉 Global Oil Shock",
        "category": "economic",
        "threat": "high",
        "start": "2026-03-25",
        "end": "2026-05-01",
        "lat": 25.0, "lon": 55.0, "radius_km": 5000,
        "effects": {
            "resource_multipliers": {"energy": 0.60, "credits": 0.82},
            "global_effect": True,
            "tdc_market_impact_pct": 15,
        },
        "tiktok_hook": "Brent à 105$ → ton jeu t'enlève 20% de tes revenus en crédits 📉",
        "tiktok_caption": "Le choc pétrolier mondial est dans le jeu. Partout. Tes territoires produisent moins. Ton Alliance doit s'adapter.",
        "ingame_news": "Brent crude above $105. Global supply chains disrupted. Credits production -20% worldwide. Energy territories now premium.",
        "viral_potential": "HIGH — economic anxiety resonates broadly",
    },

    # ─── Month 1 ───────────────────────────────────────────────────────────────
    {
        "slug": "control-tower-season-0",
        "name": "🗼 Control Tower Wars — Season 0",
        "category": "game_event",
        "threat": "none",
        "start": "2026-04-01",
        "end": "2026-04-14",
        "lat": 48.8566, "lon": 2.3522, "radius_km": 50,
        "effects": {
            "control_tower_bonus": 3.0,
            "prize_pool_tdc": 10000,
            "spectator_mode": True,
        },
        "tiktok_hook": "Il est 23h et 48 joueurs se battent pour posséder Paris 😱",
        "tiktok_caption": "Control Tower Wars — qui contrôle les 500 points stratégiques de la planète ? Prize pool : 10 000 TDC.",
        "ingame_news": "Season 0 Tower Wars begins. 10,000 TDC prize pool. Daily 3× events at 08:00, 14:00, 20:00 UTC. Alliance coordination required.",
        "viral_potential": "HIGH — live event + spectator mode = streamable content",
    },

    {
        "slug": "irgc-tanker-missions",
        "name": "⚓ Tanker Escort Missions",
        "category": "conflict_zone",
        "threat": "high",
        "start": "2026-04-05",
        "end": "2026-04-20",
        "lat": 24.0, "lon": 58.5, "radius_km": 400,
        "effects": {
            "special_mission_type": "naval_escort",
            "mission_reward_multiplier": 3.0,
            "special_unit_requirement": "naval",
            "resource_multipliers": {"credits": 1.8, "intel": 2.0},
        },
        "tiktok_hook": "Mission spéciale : escorter des pétroliers dans le détroit d'Ormuz 🛢️⚓",
        "tiktok_caption": "Nouvelle mécanique : tes unités navales peuvent escorter des tankers. Récompense : ×3 crédits si tu passes le détroit bloqué.",
        "ingame_news": "New mechanic: Naval Escort missions. Guide tankers through Hormuz for 3× credit rewards. Requires naval units. IRGC patrol risk.",
        "viral_potential": "MEDIUM-HIGH — unique game mechanic tied to live event",
    },

    # ─── Month 2 ───────────────────────────────────────────────────────────────
    {
        "slug": "geo-pipeline-5-cities",
        "name": "🌍 5 New Cities Unlocked",
        "category": "game_event",
        "threat": "none",
        "start": "2026-05-01",
        "end": None,
        "lat": 35.6762, "lon": 139.6503, "radius_km": 100,
        "effects": {
            "new_territory_bonus": True,
            "first_claim_reward_tdc": 50,
        },
        "tiktok_hook": "Tokyo, New York, Dubai, Londres… vos villes sont maintenant dans le jeu 🌍",
        "tiktok_caption": "On vient d'ajouter Paris, Londres, Tokyo, New York et Dubai. 200 000 nouvelles zones à revendiquer. Dépêche-toi.",
        "ingame_news": "5 major cities now playable. London, Tokyo, New York, Dubai, Lagos. First claim bonus: +50 TDC per zone in new cities.",
        "viral_potential": "VERY HIGH — geographic FOMO, shareable map screenshots",
    },

    {
        "slug": "taiwan-strait-tensions-2026",
        "name": "⚡ Taiwan Strait Tensions",
        "category": "conflict_zone",
        "threat": "high",
        "start": "2026-05-10",
        "end": "2026-06-01",
        "lat": 24.2292, "lon": 120.4167, "radius_km": 400,
        "effects": {
            "resource_multipliers": {"materials": 0.6, "intel": 2.5},
            "military_modifier": 2.0,
            "special_unit_unlock": "air",
            "chip_shortage_event": True,
        },
        "tiktok_hook": "Le détroit de Taiwan est en crise → la pénurie de puces est dans le jeu 💻",
        "tiktok_caption": "PLA exercices autour de Taiwan → materials −40% dans toute l'Asie-Pacifique. La deuxième crise géopolitique du jeu.",
        "ingame_news": "PLA military exercises near Taiwan. Materials production -40% in APAC region. Air support units unlocked. Intel missions ×2.5.",
        "viral_potential": "HIGH — second geopolitical event, pattern established",
    },

    {
        "slug": "eu-election-season",
        "name": "🗳️ European Elections Season",
        "category": "diplomatic",
        "threat": "low",
        "start": "2026-05-20",
        "end": "2026-06-15",
        "lat": 50.8503, "lon": 4.3517, "radius_km": 1000,
        "effects": {
            "resource_multipliers": {"culture": 2.5, "credits": 1.2},
            "capitol_bonus": True,
            "diplomatic_missions_bonus": 2.0,
        },
        "tiktok_hook": "La saison électorale en Europe × tes gains culturels dans le jeu 🗳️",
        "tiktok_caption": "Élections européennes → les capitales européennes dans le jeu donnent ×2.5 culture. Paris, Berlin, Bruxelles : champ de bataille diplomatique.",
        "ingame_news": "EU elections cycle begins. Capital territories in Europe: Culture ×2.5. Diplomatic missions earn ×2. Parliament district POIs activated.",
        "viral_potential": "MEDIUM — European audience anchor",
    },

    # ─── Month 3 ───────────────────────────────────────────────────────────────
    {
        "slug": "season-1-launch",
        "name": "🏆 Season 1 — The Empire Wars",
        "category": "game_event",
        "threat": "none",
        "start": "2026-06-01",
        "end": "2026-09-01",
        "lat": 0, "lon": 0, "radius_km": 20000,
        "effects": {
            "season_active": True,
            "battle_pass_price_eur": 4.99,
            "prize_pool_tdc": 50000,
            "leaderboard_reset": True,
            "global_effect": True,
        },
        "tiktok_hook": "Saison 1 de Terra Domini : prize pool de 50 000 TDC pour le top 100 alliances 🏆",
        "tiktok_caption": "C'est parti. 13 semaines. Leaderboard global. Battle Pass €4.99. Prize pool : 50 000 TDC pour le top 100. Qui règne sur la Terre ?",
        "ingame_news": "Season 1 begins. 13-week competitive season. Global leaderboard. 50,000 TDC prize pool for top 100 alliances. Season skins available.",
        "viral_potential": "VERY HIGH — competitive cycle launch = esports content",
    },

    {
        "slug": "tdc-polygon-mainnet",
        "name": "🪙 TDC Goes Live on Polygon",
        "category": "game_event",
        "threat": "none",
        "start": "2026-06-15",
        "end": None,
        "lat": 0, "lon": 0, "radius_km": 20000,
        "effects": {
            "tdc_withdrawal_enabled": True,
            "polygon_mainnet": True,
            "global_effect": True,
        },
        "tiktok_hook": "TDC est maintenant sur Polygon Mainnet — tu peux vraiment retirer tes gains 🪙",
        "tiktok_caption": "TDC est live sur Polygon Mainnet. Tu peux maintenant retirer tes TDC vers MetaMask et trader sur QuickSwap. C'est réel.",
        "ingame_news": "TDC now on Polygon Mainnet. Real withdrawals enabled. QuickSwap trading live. Ad revenue payouts go to real Polygon wallets.",
        "viral_potential": "VERY HIGH — 'earning real crypto' proof moment. Magnus moment.",
    },

    # ─── Month 4 ───────────────────────────────────────────────────────────────
    {
        "slug": "first-brand-advertiser",
        "name": "📢 First Brand Advertiser Live",
        "category": "economic",
        "threat": "none",
        "start": "2026-07-01",
        "end": None,
        "lat": 48.8566, "lon": 2.3522, "radius_km": 30,
        "effects": {
            "ad_revenue_multiplier": 2.0,
            "brand_cpm_live": True,
        },
        "tiktok_hook": "Une vraie marque paye pour afficher sa pub sur mes territoires Terra Domini 😳",
        "tiktok_caption": "Premier annonceur réel dans Terra Domini. Les marques paient du CPM pour tes zones. Tu reçois 70%. C'est le proof of concept du jeu.",
        "ingame_news": "First brand advertising campaign live. Territory owners in Paris region earn real CPM revenue. Check your ad earnings dashboard.",
        "viral_potential": "EXTREMELY HIGH — first real-world proof that the economic model works",
    },

    {
        "slug": "summer-alliance-wars",
        "name": "☀️ Summer Alliance Wars",
        "category": "game_event",
        "threat": "none",
        "start": "2026-07-15",
        "end": "2026-08-31",
        "lat": 0, "lon": 0, "radius_km": 20000,
        "effects": {
            "alliance_bonus_active": True,
            "territory_capture_rate": 1.5,
            "daily_mission_bonus": 2.0,
            "global_effect": True,
        },
        "tiktok_hook": "Guerres d'été : les alliances se battent pour les continents 🌍☀️",
        "tiktok_caption": "Événement estival : les alliances se disputent des continents entiers. ×1.5 vitesse de capture. ×2 récompenses missions quotidiennes.",
        "ingame_news": "Summer Wars event. Alliance territory capture rate ×1.5. Daily mission rewards ×2. Continental dominance leaderboard live.",
        "viral_potential": "HIGH — summer gaming peak, students on break",
    },

    # ─── Month 5–6 ───────────────────────────────────────────────────────────
    {
        "slug": "world-cup-2026-start",
        "name": "⚽ FIFA World Cup 2026",
        "category": "cultural",
        "threat": "none",
        "start": "2026-06-11",
        "end": "2026-07-19",
        "lat": 19.4326, "lon": -99.1332, "radius_km": 200,
        "effects": {
            "resource_multipliers": {"culture": 4.0, "credits": 1.5},
            "host_cities_bonus": True,
            "tournament_missions": True,
        },
        "tiktok_hook": "La Coupe du Monde 2026 est dans Terra Domini ⚽🗺️",
        "tiktok_caption": "Coupe du Monde 2026 au Mexique/USA/Canada → les villes hôtes donnent ×4 culture. Revendique ton stade.",
        "ingame_news": "FIFA World Cup 2026. Host city territories get Culture ×4. Stadium POIs activated across Mexico, USA, Canada. Win World Cup missions.",
        "viral_potential": "EXTREMELY HIGH — 3.5B World Cup viewers, massive crossover",
    },

    {
        "slug": "100k-player-milestone",
        "name": "🎉 100,000 Players — Earth Claimed",
        "category": "game_event",
        "threat": "none",
        "start": "2026-09-01",
        "end": None,
        "lat": 0, "lon": 0, "radius_km": 20000,
        "effects": {
            "double_xp_48h": True,
            "free_tdc_airdrop": 100,
            "global_effect": True,
        },
        "tiktok_hook": "100 000 joueurs dans 50 pays dominent la Terre 🌍🎉",
        "tiktok_caption": "Nous sommes 100 000. La Terre est revendiquée. Double XP 48h pour tous. +100 TDC airdrop pour chaque joueur actif.",
        "ingame_news": "100,000 players reached! Earth is truly claimed. Double XP for 48h. +100 TDC airdrop for all active players. Thank you.",
        "viral_potential": "MILESTONE — celebratory viral loop",
    },
]


def seed_events():
    """Seed the full 6-month events calendar into the DB."""
    import django
    from django.utils import timezone

    created = 0
    for event_data in EVENTS_CALENDAR:
        poi, was_created = WorldPOI.objects.update_or_create(
            slug=event_data["slug"],
            defaults={
                "name": event_data["name"],
                "category": event_data.get("category", "game_event"),
                "status": WorldPOI.POIStatus.ACTIVE,
                "threat_level": event_data.get("threat", "none"),
                "latitude": event_data["lat"],
                "longitude": event_data["lon"],
                "radius_km": event_data["radius_km"],
                "effects": event_data.get("effects", {}),
                "icon_emoji": event_data["name"][0] if event_data["name"][0] in "🔥📉🗼⚓🌍⚡🗳️🏆🪙📢☀️⚽🎉" else "📍",
                "icon_color": {
                    "critical": "#FF3B30", "high": "#FF9500",
                    "medium": "#FFB800", "low": "#3B82F6", "none": "#10B981"
                }.get(event_data.get("threat", "none"), "#00FF87"),
                "pulse": event_data.get("threat") in ("critical", "high"),
                "is_featured": event_data.get("threat") in ("critical", "high") or "season" in event_data["slug"],
                "news_headline": event_data.get("tiktok_hook", ""),
                "description": event_data.get("ingame_news", ""),
                "real_world_data": {
                    "tiktok_hook": event_data.get("tiktok_hook", ""),
                    "tiktok_caption": event_data.get("tiktok_caption", ""),
                    "viral_potential": event_data.get("viral_potential", ""),
                },
                "event_started_at": timezone.now(),
                "event_ends_at": None,
            }
        )
        if was_created:
            created += 1
            print(f"  ✅ {event_data['name'][:50]}")

    print(f"\n✅ Events calendar seeded: {created} created, {len(EVENTS_CALENDAR) - created} updated")
    print(f"   Total events: {len(EVENTS_CALENDAR)}")
    print(f"   Live NOW: {sum(1 for e in EVENTS_CALENDAR if e.get('threat') in ('critical','high'))}")
    print(f"   TikTok hooks ready: {len([e for e in EVENTS_CALENDAR if e.get('tiktok_hook')])}")


if __name__ == "__main__":
    import os, sys
    sys.path.insert(0, '/app')
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.dev')
    import django; django.setup()
    seed_events()
