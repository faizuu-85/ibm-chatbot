"""Application configuration settings."""

import os
import tempfile
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration."""

    # Secret key
    SECRET_KEY = os.environ.get(
        "SECRET_KEY",
        "dev-secret-key-change-in-production"
    )

    # Database
    # Set DATABASE_URL in Vercel Environment Variables.
    # Example:
    # postgresql://username:password@host:5432/database
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:///" + os.path.join(tempfile.gettempdir(), "chatbot.db")
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Upload settings
    # Vercel only allows writing to /tmp
    UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), "uploads")

    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

    ALLOWED_FILE_EXTENSIONS = {
        "pdf",
        "docx",
        "txt",
    }

    ALLOWED_IMAGE_EXTENSIONS = {
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
    }
