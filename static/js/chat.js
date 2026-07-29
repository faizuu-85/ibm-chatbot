/**
 * Chat Manager — Message sending, SSE streaming, Markdown rendering.
 */
(function() {
    'use strict';

    let currentConversationId = null;
    let isStreaming = false;

    // Configure marked.js
    function configureMarked() {
        if (typeof marked === 'undefined') return;

        const renderer = new marked.Renderer();

        // Custom code block renderer with copy button
        renderer.code = function(codeObj) {
            const text = codeObj.text || codeObj;
            const lang = codeObj.lang || '';
            
            let highlighted;
            if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
                try {
                    highlighted = hljs.highlight(text, { language: lang }).value;
                } catch (e) {
                    highlighted = escapeHtml(text);
                }
            } else {
                highlighted = escapeHtml(text);
            }

            const displayLang = lang || 'code';
            return `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span class="code-lang">${escapeHtml(displayLang)}</span>
                        <button class="copy-code-btn" onclick="NexusChat.copyCode(this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            Copy
                        </button>
                    </div>
                    <pre><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>
                </div>
            `;
        };

        marked.setOptions({
            renderer: renderer,
            breaks: true,
            gfm: true,
        });
    }

    function init() {
        configureMarked();

        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');

        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
            sendBtn.disabled = !chatInput.value.trim() && !window.NexusUpload?.getUpload();
        });

        // Send on Enter (Shift+Enter for newline)
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendBtn.disabled && !isStreaming) {
                    sendMessage();
                }
            }
        });

        // Send button click
        sendBtn.addEventListener('click', () => {
            if (!isStreaming) sendMessage();
        });

        // Suggestion chips
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                chatInput.value = chip.dataset.prompt;
                chatInput.dispatchEvent(new Event('input'));
                sendMessage();
            });
        });
    }

    // ── Send Message ─────────────────────────────────────────────────────

    async function sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        const upload = window.NexusUpload?.getUpload();

        if (!message && !upload) return;

        // Prepare the message content
        let displayMessage = message;
        let sendContent = message;

        // If there's a document upload, prepend the text
        if (upload && upload.type === 'document') {
            sendContent = `[Attached file: ${upload.filename}]\n\n${upload.text}\n\n${message}`;
            displayMessage = `📎 ${upload.filename}\n\n${message}`;
        } else if (upload && upload.type === 'image') {
            displayMessage = message || 'What can you tell me about this image?';
            sendContent = displayMessage;
        }

        // Create conversation if needed
        if (!currentConversationId) {
            try {
                const resp = await fetch('/api/conversations', { method: 'POST' });
                const convo = await resp.json();
                currentConversationId = convo.id;
                window.NexusSidebar?.setActiveConversationId(convo.id);
            } catch (err) {
                showError('Failed to create conversation.');
                return;
            }
        }

        // Hide welcome screen
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.style.display = 'none';

        // Add user message to UI
        addMessage('user', displayMessage, upload?.type === 'image' ? upload.image_data : null);

        // Clear input
        chatInput.value = '';
        chatInput.style.height = 'auto';
        document.getElementById('sendBtn').disabled = true;

        // Clear upload
        window.NexusUpload?.clearUpload();

        // Show typing indicator
        const typingEl = addTypingIndicator();

        // Stream the response
        isStreaming = true;
        try {
            const body = {
                message: sendContent,
                conversation_id: currentConversationId,
            };

            if (upload?.type === 'image') {
                body.image_data = upload.image_data;
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errData = await response.json();
                removeTypingIndicator(typingEl);
                showError(errData.error || 'Something went wrong.');
                isStreaming = false;
                return;
            }

            // Stream SSE
            removeTypingIndicator(typingEl);
            const assistantEl = addMessage('assistant', '', null, true);
            const contentEl = assistantEl.querySelector('.message-content');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let buffer = '';

            let hasError = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();  // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.error) {
                                hasError = true;
                                contentEl.innerHTML = `<div class="error-message">${escapeHtml(data.error)}</div>`;
                                break;
                            }

                            if (data.text) {
                                fullText += data.text;
                                renderMarkdown(contentEl, fullText, true);
                            }

                            if (data.done && !hasError) {
                                renderMarkdown(contentEl, fullText, false);
                            }
                        } catch (e) {
                            // Skip malformed JSON
                        }
                    }
                }

                if (hasError) break;
                scrollToBottom();
            }

            // Final render without cursor if no error occurred
            if (!hasError && fullText) {
                renderMarkdown(contentEl, fullText, false);
            }


        } catch (err) {
            removeTypingIndicator(typingEl);
            showError('Connection error. Please try again.');
        } finally {
            isStreaming = false;
            // Reload sidebar to show updated conversation
            window.NexusSidebar?.loadConversations();
        }

        scrollToBottom();
    }

    // ── Message Rendering ────────────────────────────────────────────────

    function addMessage(role, content, imageData, isStreaming) {
        const container = document.getElementById('messagesInner');
        const div = document.createElement('div');
        div.className = `message ${role}`;

        const avatarContent = role === 'user' ? 'U' : 'AI';

        let imageHtml = '';
        if (imageData) {
            imageHtml = `<img class="message-image" src="data:${imageData.mime_type};base64,${imageData.data}" alt="Uploaded image">`;
        }

        div.innerHTML = `
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-body">
                <div class="message-sender">${role === 'user' ? 'You' : 'NexusAI'}</div>
                ${imageHtml}
                <div class="message-content">${isStreaming ? '' : renderMarkdownText(content)}</div>
            </div>
        `;

        container.appendChild(div);
        scrollToBottom();
        return div;
    }

    function addTypingIndicator() {
        const container = document.getElementById('messagesInner');
        const div = document.createElement('div');
        div.className = 'message assistant typing';
        div.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-body">
                <div class="message-sender">NexusAI</div>
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        container.appendChild(div);
        scrollToBottom();
        return div;
    }

    function removeTypingIndicator(el) {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    function renderMarkdown(element, text, streaming) {
        const html = renderMarkdownText(text);
        element.innerHTML = html + (streaming ? '<span class="streaming-cursor"></span>' : '');
    }

    function renderMarkdownText(text) {
        if (!text) return '';
        if (typeof marked !== 'undefined') {
            try {
                return marked.parse(text);
            } catch (e) {
                return escapeHtml(text);
            }
        }
        return escapeHtml(text).replace(/\n/g, '<br>');
    }

    function showError(message) {
        const container = document.getElementById('messagesInner');
        const div = document.createElement('div');
        div.className = 'message assistant';
        div.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-body">
                <div class="message-sender">NexusAI</div>
                <div class="error-message">${escapeHtml(message)}</div>
            </div>
        `;
        container.appendChild(div);
        scrollToBottom();
    }

    function scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    }

    // ── Load Messages ────────────────────────────────────────────────────

    async function loadMessages(conversationId) {
        const container = document.getElementById('messagesInner');
        container.innerHTML = '';

        try {
            const resp = await fetch(`/api/conversations/${conversationId}/messages`);
            const messages = await resp.json();

            if (messages.length === 0) {
                // Show welcome for empty conversation
                container.innerHTML = document.getElementById('welcomeScreen')
                    ? ''
                    : '';
                return;
            }

            messages.forEach(msg => {
                addMessage(msg.role, msg.content);
            });

            scrollToBottom();
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    }

    // ── Conversation Management ──────────────────────────────────────────

    function setConversation(id, title) {
        currentConversationId = id;
        document.getElementById('chatTitle').textContent = title || 'New Chat';

        // Hide welcome screen
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.style.display = 'none';

        // Clear messages
        const container = document.getElementById('messagesInner');
        container.innerHTML = '';
    }

    function clearChat() {
        currentConversationId = null;
        document.getElementById('chatTitle').textContent = 'New Chat';

        const container = document.getElementById('messagesInner');
        container.innerHTML = `
            <div class="welcome-screen" id="welcomeScreen">
                <div class="welcome-icon">
                    <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
                        <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" stroke="url(#wGrad)" stroke-width="1.5" fill="none" opacity="0.6"/>
                        <path d="M14 8L20 11V17L14 20L8 17V11L14 8Z" fill="url(#wGrad)"/>
                        <defs><linearGradient id="wGrad" x1="2" y1="2" x2="26" y2="26"><stop offset="0%" stop-color="#7c5cfc"/><stop offset="100%" stop-color="#5b8def"/></linearGradient></defs>
                    </svg>
                </div>
                <h2>How can I help you today?</h2>
                <p>Start a conversation or select one from the sidebar.</p>
            </div>
        `;
    }

    // ── Copy Code ────────────────────────────────────────────────────────

    function copyCode(button) {
        const codeBlock = button.closest('.code-block-wrapper').querySelector('code');
        const text = codeBlock.textContent;

        navigator.clipboard.writeText(text).then(() => {
            button.classList.add('copied');
            button.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy
                `;
            }, 2000);
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ── Init ─────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', init);

    // Expose globally
    window.NexusChat = {
        setConversation,
        loadMessages,
        clearChat,
        copyCode,
    };
})();
