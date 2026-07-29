# NexusAI — Intelligent AI Chatbot Website

NexusAI is a full-featured, ChatGPT-like AI chatbot web application built with **Flask** (Python) for the backend and modern **HTML5/CSS3/JavaScript** for the frontend. It uses the **Google Gemini API** (`gemini-2.0-flash`) for real-time streaming AI responses, multi-modal image analysis, document processing, and voice interactions.

---

## 🌟 Key Features

- 💬 **ChatGPT-like Interface**: Smooth real-time Server-Sent Events (SSE) streaming responses.
- 🌙 **Dark & Light Mode**: Seamless theme switching with automatic system/user preference persistence.
- 🗂️ **Conversation History**: Full conversation history management with active session switching, renaming, and deletion.
- 📝 **Rich Content Rendering**: Full Markdown support + syntax-highlighted code blocks with 1-click copy buttons (powered by `marked.js` and `highlight.js`).
- 📄 **Document Upload**: Supports PDF, DOCX, and TXT files. Extracted text is automatically sent as conversation context.
- 🖼️ **Image Understanding**: Multi-modal vision support for analyzing images (PNG, JPG, GIF, WebP) using Gemini.
- 🎙️ **Voice Input**: Web Speech API integration for hands-free voice-to-text input.
- 🔐 **User Authentication**: Secure user login, signup, and session management powered by Flask-Login and Werkzeug password hashing.
- 🔑 **User API Key Integration**: Users can easily save their own Google Gemini API key directly from the Settings modal interface.
- 📱 **Fully Responsive**: Mobile-friendly layout with slide-out sidebar navigation and adaptive layouts.
- 🚀 **Modern Landing Page**: Stunning landing page featuring glassmorphic UI elements, gradient accents, and dynamic micro-animations.

---

## 📁 Project Structure

```
ai-chatbot/
├── app.py                    # Main Flask application entry point & routes
├── config.py                 # Configuration settings & environment setup
├── models.py                 # SQLAlchemy database models (User, Conversation, Message)
├── auth.py                   # Authentication blueprint (Login/Signup/Settings)
├── chat.py                   # Chat blueprint (Conversations CRUD, SSE Streaming, Uploads)
├── utils.py                  # Utility functions (PDF, DOCX, TXT parsing & image processing)
├── requirements.txt          # Python dependencies
├── .env                      # Environment variables
├── README.md                 # Setup & usage documentation
├── templates/
│   ├── base.html             # Base layout template with global styles & flash messages
│   ├── landing.html          # Public landing page
│   ├── login.html            # User login page
│   ├── signup.html           # User registration page
│   └── chat.html             # Main interactive chat application interface
├── static/
│   ├── css/
│   │   ├── landing.css       # Landing page styles & animation keyframes
│   │   ├── auth.css          # Login/Signup glassmorphism styles
│   │   └── chat.css          # Complete chat UI theme system & layout styles
│   └── js/
│       ├── theme.js          # Dark/Light mode theme controller
│       ├── voice.js          # Web Speech API voice input controller
│       ├── upload.js         # File & image upload preview controller
│       ├── sidebar.js        # Conversation list management & sidebar drawer
│       └── chat.js           # Real-time SSE chat manager & Markdown renderer
└── instance/
    └── chatbot.db            # SQLite database (auto-created on app startup)
```

---

## ⚡ Quick Start & Setup

### 1. Prerequisites
- Python 3.9 or higher
- A Google Gemini API Key (Get a free key at [Google AI Studio](https://aistudio.google.com/apikey))

### 2. Clone or Navigate to the Directory
```bash
cd /Users/mdfaiz/Desktop/python/ai-chatbot
```

### 3. Create & Activate a Virtual Environment
```bash
# On macOS / Linux:
python3 -m venv venv
source venv/bin/activate

# On Windows:
python -m venv venv
venv\Scripts\activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Run the Application
```bash
python app.py
```

Open your browser and navigate to **`http://127.0.0.1:5000`**.

---

## 📖 Usage Guide

1. **Sign Up**: Click on **Get Started** on the landing page to register a new user account.
2. **Set API Key**: Once logged in, open **Settings** (bottom left in the sidebar) and paste your Google Gemini API key.
3. **Start Chatting**:
   - Type any question into the prompt input or select one of the suggested quick prompts.
   - Click the attachment icon (📎) to upload PDFs, Word documents, or text files.
   - Click the image icon (🖼️) to upload an image and ask questions about it.
   - Click the microphone icon (🎙️) to dictate using voice input.
4. **Manage Chats**: Use the sidebar to start a **New Chat**, switch between previous conversations, or rename/delete chats.

---

## 🛡️ License & Acknowledgments
Built with Flask, SQLAlchemy, Google Gemini API, Marked.js, and Highlight.js.
