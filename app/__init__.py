from flask import Flask
from flask_compress import Compress

from app.config import Config
from app.extensions import db

compress = Compress()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config())

    db.init_app(app)
    compress.init_app(app)

    from app.routes.api import api_bp
    from app.routes.main import main_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    with app.app_context():
        db.create_all()
        try:
            db.session.execute(
                db.text("ALTER TABLE road_conditions ALTER COLUMN highway TYPE VARCHAR(100)")
            )
            db.session.commit()
        except Exception:
            db.session.rollback()

    if app.config.get("SCHEDULER_ENABLED"):
        from app.services.scheduler import init_scheduler
        init_scheduler(app)

    return app
