"""Flask application entry point."""

import os
from flask import Flask, render_template, redirect, url_for
from flask_login import LoginManager, login_required, current_user
from config import Config
from models import db, User

app = Flask(__name__)
app.config.from_object(Config)

# Ensure instance directory exists
os.makedirs(os.path.join(Config.UPLOAD_FOLDER), exist_ok=True)
os.makedirs(os.path.join(app.instance_path), exist_ok=True)

# Initialize extensions
db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "auth.login"
login_manager.login_message_category = "info"


@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for Flask-Login."""
    return User.query.get(int(user_id))


# Register blueprints
from auth import auth_bp
from chat import chat_bp

app.register_blueprint(auth_bp)
app.register_blueprint(chat_bp)


# ── Page Routes ──────────────────────────────────────────────────────────────


@app.route("/")
def landing():
    """Serve the landing page."""
    if current_user.is_authenticated:
        return redirect(url_for("chat_page"))
    return render_template("landing.html")


@app.route("/chat")
@login_required
def chat_page():
    """Serve the main chat interface."""
    return render_template("chat.html")


# ── Database Initialization ─────────────────────────────────────────────────


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(debug=True, port=port)

