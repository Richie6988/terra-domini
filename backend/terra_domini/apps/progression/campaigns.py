"""
campaigns.py — Système de Campagnes Hexod (GAME spec)

Chaque Campagne = 7 missions liées narrativement.
Chaque étape débloque quelque chose de tangible.

Campagne 1 : "Naissance d'un Empire" (J1→J7)
  Jour 1 : Claim ton premier territoire → Débloque biome Rural
  Jour 2 : Collecte 50 ressources      → Débloque biome Côtier
  Jour 3 : Claim 3 territoires         → Débloque attaque Assaut
  Jour 4 : Gagne une bataille          → Débloque skill Projection de force (gratuit)
  Jour 5 : Claim un POI               → Débloque biome Montagne visible
  Jour 6 : Rejoins ou crée alliance   → Débloque attaque Infiltration
  Jour 7 : 7 territoires dans royaume → Débloque Campagne 2 + titre "Fondateur"

Campagne 2 : "Guerre et Commerce" (J8→J14)
  Étapes similaires avec objectifs plus difficiles.
"""
from django.db import models
from django.conf import settings
from django.utils import timezone


CAMPAIGN_DATA = [
    {
        'id': 1,
        'name': 'Naissance d\'un Empire',
        'description': 'Les premiers pas d\'un grand commandant.',
        'steps': [
            {
                'day': 1, 'icon': '🏴',
                'title': 'Premier territoire',
                'desc': 'Revendique ton premier territoire sur la carte.',
                'objective_type': 'territories_owned', 'objective_value': 1,
                'reward_type': 'unlock_biome', 'reward_value': 'rural',
                'reward_label': 'Biome Rural débloqué — produit nourriture et eau',
            },
            {
                'day': 2, 'icon': '📦',
                'title': 'Première récolte',
                'desc': 'Accumule 50 unités de ressources au total.',
                'objective_type': 'resources_collected', 'objective_value': 50,
                'reward_type': 'unlock_biome', 'reward_value': 'coastal',
                'reward_label': 'Biome Côtier débloqué — eau abondante + gaz',
            },
            {
                'day': 3, 'icon': '🗺️',
                'title': 'Expansion territoriale',
                'desc': 'Possède 3 territoires simultanément.',
                'objective_type': 'territories_owned', 'objective_value': 3,
                'reward_type': 'unlock_attack', 'reward_value': 'assault',
                'reward_label': 'Type d\'attaque "Assaut" débloqué !',
            },
            {
                'day': 4, 'icon': '⚔️',
                'title': 'Baptême du feu',
                'desc': 'Remporte ta première bataille.',
                'objective_type': 'battles_won', 'objective_value': 1,
                'reward_type': 'free_skill', 'reward_value': 'attack_0',
                'reward_label': 'Skill "Projection de force" débloqué gratuitement !',
            },
            {
                'day': 5, 'icon': '⭐',
                'title': 'Site stratégique',
                'desc': 'Revendique un POI (territoire étoilé).',
                'objective_type': 'pois_owned', 'objective_value': 1,
                'reward_type': 'reveal_biome', 'reward_value': 'mountain',
                'reward_label': 'Biome Montagne révélé sur la carte — fer et titane',
            },
            {
                'day': 6, 'icon': '🤝',
                'title': 'Force collective',
                'desc': 'Rejoins une alliance ou crée la tienne.',
                'objective_type': 'has_alliance', 'objective_value': 1,
                'reward_type': 'unlock_attack', 'reward_value': 'infiltration',
                'reward_label': 'Type d\'attaque "Infiltration" débloqué !',
            },
            {
                'day': 7, 'icon': '👑',
                'title': 'Fondateur d\'Empire',
                'desc': 'Possède 7 territoires dans un même royaume.',
                'objective_type': 'kingdom_size', 'objective_value': 7,
                'reward_type': 'title_and_campaign', 'reward_value': 'Fondateur',
                'reward_label': 'Titre "Fondateur" obtenu + Campagne 2 débloquée !',
            },
        ],
    },
    {
        'id': 2,
        'name': 'Guerre et Commerce',
        'description': 'Étendre son empire par la force et les alliances.',
        'steps': [
            {
                'day': 1, 'icon': '🛢️',
                'title': 'Ressources critiques',
                'desc': 'Possède un territoire désert (pétrole).',
                'objective_type': 'biome_owned', 'objective_value': 'desert',
                'reward_type': 'unlock_attack', 'reward_value': 'blockade',
                'reward_label': 'Type d\'attaque "Blocus économique" débloqué !',
            },
            {
                'day': 2, 'icon': '💰',
                'title': 'Richesse stratégique',
                'desc': 'Accumule 500 HEX Coin.',
                'objective_type': 'hex_balance', 'objective_value': 500,
                'reward_type': 'hex_bonus', 'reward_value': 100,
                'reward_label': '+100 HEX Coin bonus',
            },
            {
                'day': 3, 'icon': '🏰',
                'title': 'Fortification',
                'desc': 'Construis ta première Fortification.',
                'objective_type': 'building_count', 'objective_value': 1,
                'reward_type': 'free_skill', 'reward_value': 'defense_0',
                'reward_label': 'Skill "Muraille défensive" débloqué gratuitement !',
            },
            {
                'day': 4, 'icon': '🔥',
                'title': 'Série de victoires',
                'desc': 'Remporte 3 batailles d\'assaut.',
                'objective_type': 'assault_wins', 'objective_value': 3,
                'reward_type': 'free_skill', 'reward_value': 'attack_1',
                'reward_label': 'Skill "Reconnaissance avancée" débloqué !',
            },
            {
                'day': 5, 'icon': '⚗️',
                'title': 'Technologie',
                'desc': 'Possède un territoire industrial.',
                'objective_type': 'biome_owned', 'objective_value': 'industrial',
                'reward_type': 'free_skill', 'reward_value': 'tech_0',
                'reward_label': 'Skill "Recherche accélérée" débloqué !',
            },
            {
                'day': 6, 'icon': '📡',
                'title': 'Réseau diplomatique',
                'desc': 'Signe un pacte avec un autre joueur.',
                'objective_type': 'alliances_signed', 'objective_value': 1,
                'reward_type': 'free_skill', 'reward_value': 'influence_0',
                'reward_label': 'Skill "Diffusion médias" débloqué !',
            },
            {
                'day': 7, 'icon': '🌍',
                'title': 'Seigneur de guerre',
                'desc': 'Possède 15 territoires dans un même royaume.',
                'objective_type': 'kingdom_size', 'objective_value': 15,
                'reward_type': 'title_and_campaign', 'reward_value': 'Seigneur de guerre',
                'reward_label': 'Titre "Seigneur de guerre" + Campagne 3 débloquée !',
            },
        ],
    },
]


class PlayerCampaign(models.Model):
    """Progression d'un joueur dans une campagne."""
    player      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='campaigns')
    campaign_id = models.IntegerField()
    current_step = models.IntegerField(default=0)  # 0-6
    completed   = models.BooleanField(default=False)
    started_at  = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('player', 'campaign_id')


def get_or_start_campaign(player, campaign_id: int = 1) -> dict:
    """Retourne l'état de la campagne pour ce joueur, la crée si besoin."""
    campaign_def = next((c for c in CAMPAIGN_DATA if c['id'] == campaign_id), None)
    if not campaign_def:
        return {'error': 'Campaign not found'}

    progress, _ = PlayerCampaign.objects.get_or_create(
        player=player, campaign_id=campaign_id
    )
    steps = campaign_def['steps']
    current = steps[progress.current_step] if progress.current_step < len(steps) else None

    return {
        'campaign_id': campaign_id,
        'name': campaign_def['name'],
        'description': campaign_def['description'],
        'current_step': progress.current_step,
        'completed': progress.completed,
        'total_steps': len(steps),
        'current_objective': current,
        'steps': [
            {**s, 'done': i < progress.current_step}
            for i, s in enumerate(steps)
        ],
    }


def check_campaign_progress(player) -> dict | None:
    """
    Vérifie si l'objectif de l'étape courante est atteint.
    Appeler après chaque action joueur significative.
    Retourne le reward si avancement.
    """
    from terra_domini.apps.territories.models import Territory

    progress = PlayerCampaign.objects.filter(player=player, completed=False).first()
    if not progress:
        # Démarrer campagne 1
        progress, _ = PlayerCampaign.objects.get_or_create(player=player, campaign_id=1)

    campaign_def = next((c for c in CAMPAIGN_DATA if c['id'] == progress.campaign_id), None)
    if not campaign_def:
        return None

    steps = campaign_def['steps']
    if progress.current_step >= len(steps):
        return None

    step = steps[progress.current_step]
    obj_type  = step['objective_type']
    obj_value = step['objective_value']

    # Évaluer l'objectif
    achieved = False
    current_value = 0

    if obj_type == 'territories_owned':
        current_value = Territory.objects.filter(owner=player).count()
        achieved = current_value >= obj_value
    elif obj_type == 'battles_won':
        current_value = getattr(player, 'battles_won', 0) or 0
        achieved = current_value >= obj_value
    elif obj_type == 'has_alliance':
        from terra_domini.apps.alliances.models import AllianceMember
        achieved = AllianceMember.objects.filter(player=player).exists()
        current_value = 1 if achieved else 0
    elif obj_type == 'kingdom_size':
        from terra_domini.apps.territories.models import TerritoryCluster
        biggest = TerritoryCluster.objects.filter(player=player).order_by('-size').first()
        current_value = biggest.size if biggest else 0
        achieved = current_value >= obj_value
    elif obj_type == 'pois_owned':
        current_value = Territory.objects.filter(owner=player, is_landmark=True).count()
        achieved = current_value >= obj_value
    elif obj_type == 'biome_owned':
        current_value = Territory.objects.filter(owner=player, biome=str(obj_value)).count()
        achieved = current_value >= 1
    elif obj_type == 'hex_balance':
        current_value = float(getattr(player, 'tdc_in_game', 0) or 0)
        achieved = current_value >= float(obj_value)

    if not achieved:
        return {
            'advanced': False,
            'step': step,
            'current_value': current_value,
            'objective_value': obj_value,
            'progress_pct': min(100, int(current_value / max(obj_value, 1) * 100)),
        }

    # Avancement !
    progress.current_step += 1
    if progress.current_step >= len(steps):
        progress.completed = True
        progress.completed_at = timezone.now()
    progress.save()

    # Appliquer le reward
    _apply_campaign_reward(player, step)

    return {
        'advanced': True,
        'completed_step': step,
        'reward_label': step['reward_label'],
        'new_step': progress.current_step,
        'campaign_completed': progress.completed,
    }


def _apply_campaign_reward(player, step: dict):
    """Applique le reward d'une étape de campagne."""
    reward_type  = step.get('reward_type', '')
    reward_value = step.get('reward_value', '')

    if reward_type == 'hex_bonus':
        from django.db.models import F
        player.__class__.objects.filter(id=player.id).update(
            tdc_in_game=F('tdc_in_game') + int(reward_value)
        )
    elif reward_type == 'free_skill':
        # Débloque gratuitement le skill via kingdom_engine
        # Format: 'attack_0' → branch attack, position 0
        try:
            branch, pos = reward_value.rsplit('_', 1)
            from terra_domini.apps.progression.models import SkillNode, PlayerSkill
            skill = SkillNode.objects.filter(branch=branch, position=int(pos)).first()
            if skill:
                PlayerSkill.objects.get_or_create(player=player, skill=skill)
        except Exception:
            pass
    elif reward_type == 'title_and_campaign':
        # Attribuer le titre + démarrer la prochaine campagne
        try:
            player.__class__.objects.filter(id=player.id).update(
                display_name=F('display_name')  # garde le display_name existant
            )
            # Créer entrée pour la prochaine campagne si elle existe
            next_id = int(step.get('campaign_id_next', 0)) or None
            if next_id:
                PlayerCampaign.objects.get_or_create(player=player, campaign_id=next_id)
        except Exception:
            pass
