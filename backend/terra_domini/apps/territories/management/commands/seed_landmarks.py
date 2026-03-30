"""
Seed famous Paris landmarks as example territories.
Run: python manage.py seed_landmarks
"""
from django.core.management.base import BaseCommand
from terra_domini.apps.territories.models import Territory


LANDMARKS = [
    {
        'h3_index': '881fb46625fffff',
        'place_name': 'Cathédrale Notre-Dame de Paris',
        'poi_name': 'Notre-Dame de Paris',
        'center_lat': 48.8530,
        'center_lon': 2.3499,
        'territory_type': 'urban',
        'rarity': 'legendary',
        'biome': 'urban',
        'is_landmark': True,
        'is_shiny': True,
        'resource_credits': 50,
        'poi_geo_score': 98,
        'poi_visitors': 12000000,
        'poi_fun_fact': 'Survived 860 years, a devastating fire in 2019, and is being restored to its former glory.',
        'poi_description': 'Gothic masterpiece on Île de la Cité. Construction began 1163, completed 1345. One of the most visited monuments in the world.',
        'poi_wiki_url': 'https://en.wikipedia.org/wiki/Notre-Dame_de_Paris',
        'custom_name': 'Notre-Dame de Paris',
        'poi_category': 'monument',
    },
    {
        'h3_index': '881fb46741fffff',
        'place_name': 'Tour Eiffel',
        'poi_name': 'Eiffel Tower',
        'center_lat': 48.8584,
        'center_lon': 2.2945,
        'territory_type': 'urban',
        'rarity': 'mythic',
        'biome': 'urban',
        'is_landmark': True,
        'is_shiny': True,
        'resource_credits': 80,
        'poi_geo_score': 100,
        'poi_visitors': 7000000,
        'poi_fun_fact': 'Built in 1889 for the World Fair. Was supposed to be temporary — almost demolished in 1909.',
        'poi_description': 'Iron lattice tower on the Champ de Mars. 330m tall. Symbol of France and most iconic landmark on Earth.',
        'poi_wiki_url': 'https://en.wikipedia.org/wiki/Eiffel_Tower',
        'custom_name': 'Tour Eiffel',
        'poi_category': 'monument',
    },
    {
        'h3_index': '881fb4675bfffff',
        'place_name': 'Musée du Louvre',
        'poi_name': 'The Louvre',
        'center_lat': 48.8606,
        'center_lon': 2.3376,
        'territory_type': 'urban',
        'rarity': 'legendary',
        'biome': 'urban',
        'is_landmark': True,
        'resource_credits': 60,
        'poi_geo_score': 97,
        'poi_visitors': 9600000,
        'poi_fun_fact': 'Home to the Mona Lisa. Was a royal palace before becoming the world\'s largest art museum.',
        'poi_description': 'World\'s most visited art museum. 380,000 objects on display across 72,735 m².',
        'poi_wiki_url': 'https://en.wikipedia.org/wiki/Louvre',
        'custom_name': 'Le Louvre',
        'poi_category': 'monument',
    },
    {
        'h3_index': '881fb475a3fffff',
        'place_name': 'Arc de Triomphe',
        'poi_name': 'Arc de Triomphe',
        'center_lat': 48.8738,
        'center_lon': 2.2950,
        'territory_type': 'urban',
        'rarity': 'epic',
        'biome': 'urban',
        'is_landmark': True,
        'resource_credits': 35,
        'poi_geo_score': 92,
        'poi_visitors': 1500000,
        'poi_fun_fact': 'Commissioned by Napoleon in 1806 after Austerlitz. Took 30 years to complete.',
        'poi_description': 'Triumphal arch at the western end of the Champs-Élysées. Honours those who fought for France.',
        'poi_wiki_url': 'https://en.wikipedia.org/wiki/Arc_de_Triomphe',
        'custom_name': 'Arc de Triomphe',
        'poi_category': 'monument',
    },
    {
        'h3_index': '881fb4666bfffff',
        'place_name': 'Basilique du Sacré-Cœur',
        'poi_name': 'Sacré-Cœur',
        'center_lat': 48.8867,
        'center_lon': 2.3431,
        'territory_type': 'urban',
        'rarity': 'epic',
        'biome': 'urban',
        'is_landmark': True,
        'resource_credits': 30,
        'poi_geo_score': 90,
        'poi_visitors': 10500000,
        'poi_fun_fact': 'Built with travertine stone that bleaches white when it rains, keeping the basilica pristine.',
        'poi_description': 'Romano-Byzantine basilica atop Montmartre, the highest point in Paris. Consecrated in 1919.',
        'poi_wiki_url': 'https://en.wikipedia.org/wiki/Sacré-Cœur,_Paris',
        'custom_name': 'Sacré-Cœur',
        'poi_category': 'temple',
    },
]


class Command(BaseCommand):
    help = 'Seed famous Paris landmarks as example territories'

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for data in LANDMARKS:
            h3 = data.pop('h3_index')
            obj, is_new = Territory.objects.update_or_create(
                h3_index=h3, defaults=data,
            )
            if is_new:
                created += 1
                self.stdout.write(self.style.SUCCESS(f'  ✅ Created: {obj.poi_name} ({obj.rarity})'))
            else:
                updated += 1
                self.stdout.write(self.style.WARNING(f'  🔄 Updated: {obj.poi_name} ({obj.rarity})'))

        self.stdout.write(self.style.SUCCESS(
            f'\n🏛 Paris landmarks seeded: {created} created, {updated} updated'
        ))
