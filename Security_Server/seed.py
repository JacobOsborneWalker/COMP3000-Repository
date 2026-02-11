## seed - populates the database with the stater data

from app import app
from models import db, User

with app.app_context():
    db.create_all()

    if not User.query.first():
        users = [
            User(username="staff", role="staff"),
            User(username="safeguard", role="safeguard"),
            User(username="admin", role="admin")
        ]

        db.session.add_all(users)
        db.session.commit()
        print("Users seeded")
