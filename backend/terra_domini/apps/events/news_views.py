"""
News Events API — live/upcoming events, registration, results.

Endpoints:
  GET  /api/events/news/              — List active + upcoming events
  POST /api/events/news/<id>/register/ — Register for event (costs HEX)
  GET  /api/events/news/my-results/    — Player's event results
  POST /api/events/news/resolve/       — Admin: resolve ended events (distribute rewards)
"""
import random
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from terra_domini.apps.events.news_models import NewsEvent, NewsEventRegistration


def _serialize_event(event, player=None):
    """Serialize a NewsEvent for the frontend."""
    reg = None
    if player and player.is_authenticated:
        reg = event.registrations.filter(player=player).first()
    return {
        'id': str(event.id),
        'headline': event.headline,
        'summary': event.summary,
        'image_url': event.image_url,
        'source_name': event.source_name,
        'source_url': event.source_url,
        'location_name': event.location_name,
        'latitude': event.latitude,
        'longitude': event.longitude,
        'category': event.hexod_category,
        'rarity': event.rarity,
        'status': event.status,
        'hex_reward': event.hex_reward,
        'max_participants': event.max_participants,
        'registration_cost': event.registration_cost,
        'registered_count': event.registered_count,
        'starts_at': event.starts_at.isoformat(),
        'ends_at': event.ends_at.isoformat(),
        'time_remaining': event.time_remaining,
        'is_active': event.is_active,
        'published_at': event.published_at.isoformat(),
        # Player-specific
        'my_registered': reg is not None,
        'my_result': reg.result if reg else None,
        'my_hex_earned': reg.hex_earned if reg else 0,
        'my_serial': reg.token_serial if reg else None,
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def list_news_events(request):
    """GET /api/events/news/ — active + upcoming events."""
    now = timezone.now()
    # Auto-expire old events
    NewsEvent.objects.filter(ends_at__lt=now, status='live').update(status='ended')

    events = NewsEvent.objects.filter(
        status__in=['live', 'upcoming'],
        ends_at__gte=now,
    ).order_by('-rarity', '-starts_at')[:50]

    return Response({
        'count': events.count(),
        'results': [_serialize_event(e, request.user) for e in events],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_for_event(request, event_id):
    """POST /api/events/news/<id>/register/ — register for event."""
    try:
        event = NewsEvent.objects.get(id=event_id)
    except NewsEvent.DoesNotExist:
        return Response({'error': 'Event not found'}, status=404)

    if not event.is_active:
        return Response({'error': 'Event is not active'}, status=400)

    if event.registered_count >= event.max_participants:
        return Response({'error': 'Event is full'}, status=400)

    if NewsEventRegistration.objects.filter(event=event, player=request.user).exists():
        return Response({'error': 'Already registered'}, status=400)

    # Check balance
    player = request.user
    balance = float(getattr(player, 'tdc_in_game', 0) or 0)
    cost = event.registration_cost
    if balance < cost:
        return Response({'error': f'Insufficient balance. Need {cost} HEX'}, status=400)

    # Deduct cost
    if cost > 0:
        player.tdc_in_game = balance - cost
        player.save(update_fields=['tdc_in_game'])

    NewsEventRegistration.objects.create(event=event, player=player)

    return Response({
        'success': True,
        'message': f'Registered for {event.headline[:50]}',
        'cost': cost,
        'remaining_balance': float(player.tdc_in_game),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_event_results(request):
    """GET /api/events/news/my-results/ — player's event registrations + results."""
    regs = NewsEventRegistration.objects.filter(
        player=request.user
    ).select_related('event').order_by('-registered_at')[:50]

    results = []
    for reg in regs:
        ev = reg.event
        results.append({
            'id': str(reg.id),
            'event_id': str(ev.id),
            'headline': ev.headline,
            'image_url': ev.image_url,
            'location_name': ev.location_name,
            'category': ev.hexod_category,
            'rarity': ev.rarity,
            'color': {
                'common': '#94a3b8', 'uncommon': '#22c55e', 'rare': '#3b82f6',
                'epic': '#8b5cf6', 'legendary': '#f59e0b', 'mythic': '#ef4444',
            }.get(ev.rarity, '#94a3b8'),
            'result': reg.result,
            'hex_earned': reg.hex_earned,
            'serial': reg.token_serial,
            'max_serial': ev.max_participants,
            'luck_bonus': reg.luck_bonus,
            'registered_at': reg.registered_at.isoformat(),
            'event_ended': ev.status in ('ended', 'expired'),
        })

    return Response({'count': len(results), 'results': results})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resolve_events(request):
    """POST /api/events/news/resolve/ — Admin: resolve ended events, distribute rewards."""
    if not request.user.is_staff:
        return Response({'error': 'Admin only'}, status=403)

    now = timezone.now()
    ended = NewsEvent.objects.filter(status='live', ends_at__lt=now)
    resolved_count = 0

    for event in ended:
        regs = list(event.registrations.filter(result='pending'))
        if not regs:
            event.status = 'expired'
            event.save(update_fields=['status'])
            continue

        # Determine winners based on luck
        # Win chance: common 90%, uncommon 80%, rare 60%, epic 40%, legendary 25%, mythic 10%
        win_chance = {
            'common': 0.90, 'uncommon': 0.80, 'rare': 0.60,
            'epic': 0.40, 'legendary': 0.25, 'mythic': 0.10,
        }.get(event.rarity, 0.50)

        serial = 1
        for reg in regs:
            # Luck bonus from player skills (placeholder — check progression)
            luck_bonus = random.randint(0, 15)
            effective_chance = min(0.95, win_chance + luck_bonus * 0.01)

            if random.random() < effective_chance:
                reg.result = 'won'
                reg.hex_earned = event.hex_reward
                reg.token_serial = serial
                reg.luck_bonus = luck_bonus
                serial += 1
                # Credit HEX
                player = reg.player
                player.tdc_in_game = float(player.tdc_in_game or 0) + event.hex_reward
                player.save(update_fields=['tdc_in_game'])
            else:
                reg.result = 'lost'
                reg.luck_bonus = luck_bonus
            reg.save()

        event.status = 'ended'
        event.save(update_fields=['status'])
        resolved_count += 1

    return Response({'resolved': resolved_count})
