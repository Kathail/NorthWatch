from flask import Flask

from app.config import Config
from app.extensions import db


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config())

    db.init_app(app)

    from app.routes.api import api_bp
    from app.routes.main import main_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    with app.app_context():
        db.create_all()

    if app.config.get("SCHEDULER_ENABLED"):
        from app.services.scheduler import init_scheduler
        init_scheduler(app)

    return app
