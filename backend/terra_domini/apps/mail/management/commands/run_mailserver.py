"""
Local SMTP server — catches all outgoing emails and stores in DB.
Run: python manage.py run_mailserver [--port 1025]

Then configure Django: SMTP_HOST=localhost SMTP_PORT=1025 SMTP_USE_TLS=false

Emails viewable in Django Admin → Caught Emails
or via API: GET /api/mail/inbox/
"""
import asyncio
import email
from email import policy
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import SMTP as SMTPServer

from django.core.management.base import BaseCommand


class HexodMailHandler:
    """Stores every received email in the Django DB."""

    async def handle_DATA(self, server, session, envelope):
        from terra_domini.apps.mail.models import CaughtEmail

        raw_data = envelope.content.decode('utf-8', errors='replace')

        # Parse email
        msg = email.message_from_string(raw_data, policy=policy.default)
        subject = msg.get('Subject', '(no subject)')
        sender = envelope.mail_from or msg.get('From', '')
        recipients = ', '.join(envelope.rcpt_tos)

        # Extract body
        body_text = ''
        body_html = ''
        if msg.is_multipart():
            for part in msg.walk():
                ct = part.get_content_type()
                if ct == 'text/plain':
                    body_text = part.get_content()
                elif ct == 'text/html':
                    body_html = part.get_content()
        else:
            ct = msg.get_content_type()
            content = msg.get_content()
            if ct == 'text/html':
                body_html = content
            else:
                body_text = content

        # Store in DB
        CaughtEmail.objects.create(
            sender=sender,
            recipients=recipients,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            raw=raw_data[:50000],  # cap at 50KB
        )

        print(f'  📧 {sender} → {recipients}: {subject}')
        return '250 OK'


class Command(BaseCommand):
    help = 'Run local SMTP server (like Mailpit) — catches all emails'

    def add_arguments(self, parser):
        parser.add_argument('--port', type=int, default=1025, help='SMTP port (default: 1025)')
        parser.add_argument('--host', default='127.0.0.1', help='Bind address (default: 127.0.0.1)')

    def handle(self, *args, **options):
        port = options['port']
        host = options['host']

        handler = HexodMailHandler()
        controller = Controller(handler, hostname=host, port=port)
        controller.start()

        self.stdout.write(self.style.SUCCESS(
            f'\n'
            f'  ╔══════════════════════════════════════════╗\n'
            f'  ║  📧 HEXOD Mail Server                    ║\n'
            f'  ║  SMTP: {host}:{port:<24}║\n'
            f'  ║  Inbox: /admin/ → Caught Emails          ║\n'
            f'  ║  API:   /api/mail/inbox/                 ║\n'
            f'  ╚══════════════════════════════════════════╝\n'
            f'\n'
            f'  Configure Django:\n'
            f'    SMTP_HOST=localhost SMTP_PORT={port} SMTP_USE_TLS=false\n'
            f'\n'
            f'  Waiting for emails... (Ctrl+C to stop)\n'
        ))

        try:
            asyncio.get_event_loop().run_forever()
        except KeyboardInterrupt:
            controller.stop()
            self.stdout.write(self.style.WARNING('\n  Mail server stopped.'))
