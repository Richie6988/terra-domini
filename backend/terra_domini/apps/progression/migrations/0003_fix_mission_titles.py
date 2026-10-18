"""Older databases were seeded with singular-only mission titles ("Launch 2 attack").
Point those templates at the pluralising placeholders and fix today's generated titles."""
import re
from django.db import migrations

FIX = {
    'win_battles': ('Launch {target} attack', 'Launch {target} attack{s}'),
    'claim': ('Claim {target} new territory', 'Claim {target} new territor{ies}'),
    'produce': ('Collect your harvest {target} times', 'Collect your harvest {target} time{s}'),
}
ROW = [
    (re.compile(r'^Launch (\d+) attack$'), lambda n: f'Launch {n} attack' + ('' if n == 1 else 's')),
    (re.compile(r'^Claim (\d+) new territory$'), lambda n: f'Claim {n} new territor' + ('y' if n == 1 else 'ies')),
    (re.compile(r'^Collect your harvest (\d+) times$'), lambda n: f'Collect your harvest {n} time' + ('' if n == 1 else 's')),
]


def forwards(apps, schema_editor):
    MT = apps.get_model('progression', 'MissionTemplate')
    PDM = apps.get_model('progression', 'PlayerDailyMission')
    for mtype, (old, new) in FIX.items():
        MT.objects.filter(mission_type=mtype, title_template=old).update(title_template=new)
    for m in PDM.objects.filter(is_claimed=False).only('id', 'title'):
        for rx, fmt in ROW:
            hit = rx.match(m.title or '')
            if hit:
                fixed = fmt(int(hit.group(1)))
                if fixed != m.title:
                    PDM.objects.filter(id=m.id).update(title=fixed)
                break


class Migration(migrations.Migration):
    dependencies = [('progression', '0002_seed_mission_templates')]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
