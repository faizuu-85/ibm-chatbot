"""Chat API blueprint — conversations, messages, streaming, file upload."""

import os
import json
import requests
from flask import Blueprint, request, jsonify, Response, stream_with_context
from flask_login import login_required, current_user
from models import db, Conversation, Message
from utils import extract_file_text, process_image_for_gemini, allowed_file
from config import Config

chat_bp = Blueprint("chat", __name__, url_prefix="/api")


from dotenv import load_dotenv


def get_effective_api_key():
    """Return user's API key or fall back to environment variables."""
    if current_user.is_authenticated and current_user.api_key:
        return current_user.api_key.strip()
    
    # Dynamically reload .env to catch any new additions immediately
    load_dotenv(override=True)

    for env_var in ["GEMINI_API_KEY", "OPENAI_API_KEY", "API_KEY", "SECRET_KEY"]:
        val = os.environ.get(env_var, "").strip()
        if val and not val.startswith("nexus-ai-") and not val.startswith("dev-secret-"):
            return val
    return ""




# ── Conversation CRUD ───────────────────────────────────────────────────────


@chat_bp.route("/conversations", methods=["GET"])
@login_required
def list_conversations():
    """List all conversations for the current user."""
    convos = (
        Conversation.query.filter_by(user_id=current_user.id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return jsonify([c.to_dict() for c in convos])


@chat_bp.route("/conversations", methods=["POST"])
@login_required
def create_conversation():
    """Create a new conversation."""
    convo = Conversation(user_id=current_user.id, title="New Chat")
    db.session.add(convo)
    db.session.commit()
    return jsonify(convo.to_dict()), 201


@chat_bp.route("/conversations/<int:convo_id>", methods=["PUT"])
@login_required
def rename_conversation(convo_id):
    """Rename a conversation."""
    convo = Conversation.query.filter_by(id=convo_id, user_id=current_user.id).first_or_404()
    data = request.get_json()
    title = data.get("title", "").strip()
    if title:
        convo.title = title[:200]
        db.session.commit()
    return jsonify(convo.to_dict())


@chat_bp.route("/conversations/<int:convo_id>", methods=["DELETE"])
@login_required
def delete_conversation(convo_id):
    """Delete a conversation and all its messages."""
    convo = Conversation.query.filter_by(id=convo_id, user_id=current_user.id).first_or_404()
    db.session.delete(convo)
    db.session.commit()
    return jsonify({"success": True})


@chat_bp.route("/conversations/<int:convo_id>/messages", methods=["GET"])
@login_required
def get_messages(convo_id):
    """Get all messages for a conversation."""
    convo = Conversation.query.filter_by(id=convo_id, user_id=current_user.id).first_or_404()
    messages = convo.messages.order_by(Message.created_at.asc()).all()
    return jsonify([m.to_dict() for m in messages])


# ── Chat / Streaming ────────────────────────────────────────────────────────


@chat_bp.route("/chat", methods=["POST"])
@login_required
def chat():
    """Send a message and stream the AI response via SSE."""
    api_key = get_effective_api_key()
    if not api_key:
        return jsonify({"error": "Please set your API key (Gemini or OpenAI) in Settings."}), 400

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided."}), 400

    user_message = data.get("message", "").strip()
    convo_id = data.get("conversation_id")
    image_data = data.get("image_data")  # base64 image from upload

    if not user_message and not image_data:
        return jsonify({"error": "Message cannot be empty."}), 400

    # Get or create conversation
    if convo_id:
        convo = Conversation.query.filter_by(
            id=convo_id, user_id=current_user.id
        ).first_or_404()
    else:
        convo = Conversation(user_id=current_user.id, title="New Chat")
        db.session.add(convo)
        db.session.commit()

    # Save user message
    user_msg = Message(conversation_id=convo.id, role="user", content=user_message)
    db.session.add(user_msg)
    db.session.commit()

    # Auto-title: use first message as title if it's "New Chat"
    if convo.title == "New Chat" and user_message:
        title_text = user_message[:80]
        if len(user_message) > 80:
            title_text += "..."
        convo.title = title_text
        db.session.commit()

    past_messages = (
        convo.messages.order_by(Message.created_at.asc())
        .filter(Message.id != user_msg.id)
        .limit(50)
        .all()
    )

    convo_id_for_stream = convo.id
    is_openai_key = api_key.startswith("sk-")

    def generate():
        """Generator for SSE streaming."""
        full_response = []
        try:
            if is_openai_key:
                # ── OpenAI Streaming API ─────────────────────────────────
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }
                oai_messages = []
                for msg in past_messages:
                    oai_messages.append({
                        "role": "user" if msg.role == "user" else "assistant",
                        "content": msg.content,
                    })

                if image_data:
                    oai_messages.append({
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_message or "Analyze this image."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{image_data.get('mime_type', 'image/jpeg')};base64,{image_data.get('data', '')}"
                                },
                            },
                        ],
                    })
                else:
                    oai_messages.append({"role": "user", "content": user_message})

                payload = {
                    "model": "gpt-4o-mini",
                    "messages": oai_messages,
                    "stream": True,
                }

                res = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    stream=True,
                    timeout=60,
                )

                if res.status_code != 200:
                    try:
                        err_json = res.json()
                        err_msg = err_json.get("error", {}).get("message") or f"OpenAI API Error ({res.status_code})"
                    except Exception:
                        err_msg = f"OpenAI API Error ({res.status_code}): {res.text[:200]}"
                    yield f"data: {json.dumps({'error': err_msg, 'done': True})}\n\n"
                    return


                for line in res.iter_lines():
                    if line:
                        line_str = line.decode("utf-8")
                        if line_str.startswith("data: "):
                            data_str = line_str[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk_json = json.loads(data_str)
                                choices = chunk_json.get("choices", [])
                                if choices:
                                    delta_text = choices[0].get("delta", {}).get("content", "")
                                    if delta_text:
                                        full_response.append(delta_text)
                                        yield f"data: {json.dumps({'text': delta_text, 'done': False})}\n\n"
                            except Exception:
                                pass
            else:
                # ── Gemini Streaming API ─────────────────────────────────
                import google.generativeai as genai

                genai.configure(api_key=api_key)

                history = []
                for msg in past_messages:
                    role = "user" if msg.role == "user" else "model"
                    history.append({"role": role, "parts": [msg.content]})

                # Try models in order of availability
                gemini_models = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
                response = None
                last_err = None

                for model_name in gemini_models:
                    try:
                        if image_data:
                            model = genai.GenerativeModel(model_name)
                            image_part = {
                                "mime_type": image_data.get("mime_type", "image/jpeg"),
                                "data": image_data.get("data", ""),
                            }
                            prompt_parts = []
                            if user_message:
                                prompt_parts.append(user_message)
                            prompt_parts.append(image_part)
                            response = model.generate_content(prompt_parts, stream=True)
                        else:
                            model = genai.GenerativeModel(model_name)
                            chat_session = model.start_chat(history=history)
                            response = chat_session.send_message(user_message, stream=True)
                        break
                    except Exception as ex:
                        last_err = ex
                        continue

                if response is None:
                    raise last_err or Exception("Failed to initialize Gemini model.")

                for chunk in response:
                    if chunk.text:
                        full_response.append(chunk.text)
                        event_data = json.dumps({"text": chunk.text, "done": False})
                        yield f"data: {event_data}\n\n"


            # Save assistant response to DB
            assistant_text = "".join(full_response)
            if assistant_text:
                from app import app

                with app.app_context():
                    assistant_msg = Message(
                        conversation_id=convo_id_for_stream,
                        role="assistant",
                        content=assistant_text,
                    )
                    db.session.add(assistant_msg)
                    db.session.commit()

            yield f"data: {json.dumps({'text': '', 'done': True})}\n\n"

        except Exception as e:
            error_msg = str(e)
            if "API_KEY_INVALID" in error_msg or "INVALID_ARGUMENT" in error_msg:
                error_msg = "Invalid API key. Please check your API key in Settings."
            elif "RESOURCE_EXHAUSTED" in error_msg:
                error_msg = "API rate limit exceeded. Please wait a moment and try again."
            yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── File Upload ──────────────────────────────────────────────────────────────


@chat_bp.route("/upload", methods=["POST"])
@login_required
def upload_file():
    """Handle file or image upload."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected."}), 400

    filename = file.filename
    ext = filename.rsplit(".", 1)[1].lower() if "." in filename else ""

    if ext in Config.ALLOWED_IMAGE_EXTENSIONS:
        image_data = process_image_for_gemini(file)
        if image_data:
            return jsonify({
                "type": "image",
                "filename": filename,
                "image_data": image_data,
            })
        return jsonify({"error": "Failed to process image."}), 400

    if ext in Config.ALLOWED_FILE_EXTENSIONS:
        text = extract_file_text(file, filename)
        return jsonify({
            "type": "document",
            "filename": filename,
            "text": text,
        })

    return jsonify({
        "error": f"Unsupported file type: .{ext}. Allowed: PDF, DOCX, TXT, PNG, JPG, GIF, WebP"
    }), 400
