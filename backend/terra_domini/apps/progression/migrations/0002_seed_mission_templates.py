"""Seed daily mission templates (the table was empty → no missions ever generated)."""
from django.db import migrations

TEMPLATES = [
    # (mission_type, title_template, description, icon, difficulty, tmin, tmax, rmin, rmax, xp)
    ('produce', 'Collect your harvest {target} time{s}', 'Come back and collect your territories’ HEX stock.', 'wheat', 'easy', 2, 3, 60, 90, 80),
    ('claim', 'Claim {target} new territor{ies}', 'Buy or explore a new hex next to your kingdom.', 'pin', 'medium', 1, 1, 90, 130, 120),
    ('win_battles', 'Launch {target} attack{s}', 'Send troops against an enemy territory.', 'swords', 'medium', 1, 2, 90, 140, 120),
    ('spend_tdc', 'Spend {target} HEX', 'Invest HEX in territories, troops or reinforcements.', 'hex_coin', 'easy', 100, 250, 50, 80, 60),
    ('recruit', 'Recruit {target} troops', 'Train units in the Military panel.', 'muscle', 'easy', 10, 25, 50, 80, 60),
]


def seed(apps, schema_editor):
    MT = apps.get_model('progression', 'MissionTemplate')
    for t, title, desc, icon, diff, tmin, tmax, rmin, rmax, xp in TEMPLATES:
        if MT.objects.filter(mission_type=t).exists():
            continue
        MT.objects.create(mission_type=t, title_template=title, description=desc, icon_emoji=icon,
                          difficulty=diff, target_min=tmin, target_max=tmax,
                          reward_tdc_min=rmin, reward_tdc_max=rmax, reward_xp=xp, is_active=True)


class Migration(migrations.Migration):
    dependencies = [('progression', '0001_initial')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
