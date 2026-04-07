import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SCHEDULER_ENABLED = os.environ.get("SCHEDULER_ENABLED", "true").lower() == "true"

    def __init__(self):
        if not self.SECRET_KEY:
            if os.environ.get("FLASK_DEBUG") == "1" or os.environ.get("FLASK_ENV") == "development":
                self.SECRET_KEY = "dev-only-insecure-key"
            else:
                raise RuntimeError("SECRET_KEY environment variable is required in production")

        uri = os.environ.get("DATABASE_URL", "sqlite:///northwatch.db")
        if uri.startswith("postgres://"):
            uri = uri.replace("postgres://", "postgresql://", 1)
        self.SQLALCHEMY_DATABASE_URI = uri
