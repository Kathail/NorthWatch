import os

from flask import Blueprint, send_from_directory

main_bp = Blueprint("main", __name__)

DIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "static", "dist"
)


@main_bp.route("/debug-path")
def debug_path():
    import json
    exists = os.path.isdir(DIST_DIR)
    files = os.listdir(DIST_DIR) if exists else []
    return json.dumps({"dist_dir": DIST_DIR, "exists": exists, "files": files})


@main_bp.route("/")
def dashboard():
    return send_from_directory(DIST_DIR, "index.html")


@main_bp.route("/<path:path>")
def catch_all(path):
    full = os.path.join(DIST_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")
