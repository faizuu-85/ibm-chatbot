"""Utility functions for file parsing and processing."""

import os
import base64
from io import BytesIO
from PIL import Image
import PyPDF2
import docx


def allowed_file(filename, allowed_extensions):
    """Check if a filename has an allowed extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions


def extract_text_from_pdf(file_storage):
    """Extract text content from a PDF file."""
    try:
        reader = PyPDF2.PdfReader(file_storage)
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n\n".join(text_parts) if text_parts else "[Could not extract text from PDF]"
    except Exception as e:
        return f"[Error reading PDF: {str(e)}]"


def extract_text_from_docx(file_storage):
    """Extract text content from a DOCX file."""
    try:
        doc = docx.Document(file_storage)
        text_parts = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n\n".join(text_parts) if text_parts else "[Could not extract text from DOCX]"
    except Exception as e:
        return f"[Error reading DOCX: {str(e)}]"


def extract_text_from_txt(file_storage):
    """Extract text content from a TXT file."""
    try:
        content = file_storage.read()
        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="replace")
        return content if content.strip() else "[Empty text file]"
    except Exception as e:
        return f"[Error reading TXT: {str(e)}]"


def extract_file_text(file_storage, filename):
    """Route file to appropriate extractor based on extension."""
    ext = filename.rsplit(".", 1)[1].lower()
    if ext == "pdf":
        return extract_text_from_pdf(file_storage)
    elif ext == "docx":
        return extract_text_from_docx(file_storage)
    elif ext == "txt":
        return extract_text_from_txt(file_storage)
    else:
        return f"[Unsupported file type: .{ext}]"


def process_image_for_gemini(file_storage):
    """Process an uploaded image for Gemini Vision API.

    Returns a dict with mime_type and base64-encoded data.
    """
    try:
        img = Image.open(file_storage)

        # Resize if too large (max 2048px on longest side)
        max_size = 2048
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        # Convert to RGB if necessary (e.g., RGBA PNGs)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        # Save to bytes
        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        buffer.seek(0)
        image_bytes = buffer.read()

        return {
            "mime_type": "image/jpeg",
            "data": base64.b64encode(image_bytes).decode("utf-8"),
        }
    except Exception as e:
        return None


def ensure_upload_dir(upload_folder):
    """Create the upload directory if it doesn't exist."""
    os.makedirs(upload_folder, exist_ok=True)
