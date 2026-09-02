"""Queue and dispatch supporter match notifications once.

Run every 10–15 minutes from the deployed scheduler::

    python scripts/process_fan_notifications.py
"""

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.fan_notifications import dispatch_fan_notifications, queue_fan_match_notifications


def main() -> None:
    with SessionLocal() as db:
        queued = queue_fan_match_notifications(db)
        sent, failed = dispatch_fan_notifications(db, get_settings())
    print(f"fan notifications: queued={queued} sent={sent} failed={failed}")


if __name__ == "__main__":
    main()
