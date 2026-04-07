import os

from flask import Blueprint, send_from_directory, jsonify

main_bp = Blueprint("main", __name__)

DIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "dist"
)


@main_bp.route("/debug-dist")
def debug_dist():
    parent = os.path.dirname(DIST_DIR)
    return jsonify({
        "dist_dir": DIST_DIR,
        "exists": os.path.isdir(DIST_DIR),
        "parent_exists": os.path.isdir(parent),
        "parent_contents": os.listdir(parent) if os.path.isdir(parent) else [],
        "cwd": os.getcwd(),
        "app_file": os.path.abspath(__file__),
    })


@main_bp.route("/")
def dashboard():
    return send_from_directory(DIST_DIR, "index.html")


@main_bp.route("/<path:path>")
def catch_all(path):
    full = os.path.join(DIST_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")
