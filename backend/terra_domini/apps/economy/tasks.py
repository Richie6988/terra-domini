from celery import shared_task

@shared_task(name='economy.calculate_offline_income')
def calculate_offline_income():
    """Handled inline by territory tick — stub for beat schedule."""
    pass
