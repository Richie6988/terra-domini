"""
Management command: python manage.py run_poi_agent [--phase 1|2|3|all]
Runs the POI intelligence agent to populate the 10,000 POI database.
"""
from django.core.management.base import BaseCommand
from terra_domini.agents.poi_agent import POIOrchestrator

class Command(BaseCommand):
    help = 'Run POI Intelligence Agent to populate database'

    def add_arguments(self, parser):
        parser.add_argument('--phase', default='all', choices=['1','2','3','all','status'])
        parser.add_argument('--categories', nargs='+', help='Specific categories to harvest')
        parser.add_argument('--limit', type=int, default=50, help='POIs per category')

    def handle(self, *args, **options):
        agent = POIOrchestrator()
        phase = options['phase']
        cats  = options.get('categories')
        limit = options['limit']

        if phase == 'status':
            status = agent.get_status()
            self.stdout.write(f"\n🌍 POI Database Status")
            self.stdout.write(f"   Total: {status['total']} / {status['target']} ({status['progress_pct']}%)")
            self.stdout.write(f"   By source: {status['by_source']}")
            self.stdout.write(f"   By rarity: {status['by_rarity']}")
            return

        self.stdout.write(f"🤖 Starting POI Agent — Phase {phase}")

        if phase in ('1', 'all'):
            self.stdout.write("📡 Phase 1: Harvesting OSM + open databases...")
            n = agent.run_phase1(cats, limit)
            self.stdout.write(self.style.SUCCESS(f"   ✅ {n} POIs from open databases"))

        if phase in ('2', 'all'):
            self.stdout.write("🧠 Phase 2: AI generation (secret/exclusive POIs)...")
            n = agent.run_phase2(cats, min(limit, 25))
            self.stdout.write(self.style.SUCCESS(f"   ✅ {n} POIs from AI"))

        if phase in ('3', 'all'):
            self.stdout.write("📰 Phase 3: Live news events...")
            events = agent.run_phase3_news()
            self.stdout.write(self.style.SUCCESS(f"   ✅ {len(events)} live events"))

        status = agent.get_status()
        self.stdout.write(f"\n📊 Total POIs: {status['total']} / {status['target']}")
