from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .models import CaughtEmail


@api_view(['GET'])
@permission_classes([IsAdminUser])
def inbox(request):
    """GET /api/mail/inbox/ — list caught emails (admin only)."""
    emails = CaughtEmail.objects.all()[:50]
    return Response([{
        'id': e.id,
        'sender': e.sender,
        'recipients': e.recipients,
        'subject': e.subject,
        'body_text': e.body_text[:500],
        'body_html': e.body_html[:2000],
        'received_at': e.received_at.isoformat(),
        'read': e.read,
    } for e in emails])


@api_view(['POST'])
@permission_classes([IsAdminUser])
def mark_read(request, pk):
    """POST /api/mail/<pk>/read/ — mark as read."""
    try:
        e = CaughtEmail.objects.get(pk=pk)
        e.read = True
        e.save()
        return Response({'status': 'ok'})
    except CaughtEmail.DoesNotExist:
        return Response({'error': 'not found'}, status=404)
