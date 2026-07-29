/**
 * Sidebar Manager — Conversation list CRUD and mobile toggle.
 */
(function() {
    'use strict';

    let activeConversationId = null;

    function init() {
        const newChatBtn = document.getElementById('newChatBtn');
        const openSidebar = document.getElementById('openSidebar');
        const closeSidebar = document.getElementById('closeSidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettings = document.getElementById('closeSettings');
        const saveSettingsBtn = document.getElementById('saveSettings');
        const toggleApiKey = document.getElementById('toggleApiKey');

        // New chat
        newChatBtn.addEventListener('click', () => {
            createNewChat();
            closeMobileSidebar();
        });

        // Mobile sidebar
        openSidebar.addEventListener('click', openMobileSidebar);
        closeSidebar.addEventListener('click', closeMobileSidebar);
        sidebarOverlay.addEventListener('click', closeMobileSidebar);

        // Settings
        settingsBtn.addEventListener('click', openSettings);
        closeSettings.addEventListener('click', closeSettingsModal);
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettingsModal();
        });
        saveSettingsBtn.addEventListener('click', saveSettings);

        // Toggle API key visibility
        toggleApiKey.addEventListener('click', () => {
            const input = document.getElementById('apiKeyInput');
            input.type = input.type === 'password' ? 'text' : 'password';
        });

        // Load conversations
        loadConversations();
    }

    // ── Conversations ────────────────────────────────────────────────────

    async function loadConversations() {
        try {
            const resp = await fetch('/api/conversations');
            const convos = await resp.json();
            renderConversations(convos);
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }

    function renderConversations(convos) {
        const list = document.getElementById('conversationsList');
        list.innerHTML = '';

        if (convos.length === 0) {
            list.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
                    No conversations yet.<br>Start a new chat!
                </div>
            `;
            return;
        }

        convos.forEach(convo => {
            const item = document.createElement('div');
            item.className = `convo-item${convo.id === activeConversationId ? ' active' : ''}`;
            item.dataset.id = convo.id;

            item.innerHTML = `
                <svg class="convo-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span class="convo-title">${escapeHtml(convo.title)}</span>
                <div class="convo-actions">
                    <button class="convo-action-btn rename" title="Rename" data-id="${convo.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="convo-action-btn delete" title="Delete" data-id="${convo.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            `;

            // Click to open
            item.addEventListener('click', (e) => {
                if (e.target.closest('.convo-action-btn')) return;
                selectConversation(convo.id, convo.title);
                closeMobileSidebar();
            });

            // Rename
            item.querySelector('.rename').addEventListener('click', (e) => {
                e.stopPropagation();
                renameConversation(convo.id, convo.title);
            });

            // Delete
            item.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteConversation(convo.id);
            });

            list.appendChild(item);
        });
    }

    async function createNewChat() {
        try {
            const resp = await fetch('/api/conversations', { method: 'POST' });
            const convo = await resp.json();
            activeConversationId = convo.id;
            await loadConversations();

            // Reset chat UI
            if (window.NexusChat) {
                window.NexusChat.setConversation(convo.id, convo.title);
            }
        } catch (err) {
            console.error('Failed to create conversation:', err);
        }
    }

    async function selectConversation(id, title) {
        activeConversationId = id;

        // Update active state
        document.querySelectorAll('.convo-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.id) === id);
        });

        // Load messages
        if (window.NexusChat) {
            window.NexusChat.setConversation(id, title);
            await window.NexusChat.loadMessages(id);
        }
    }

    async function renameConversation(id, currentTitle) {
        const newTitle = prompt('Rename conversation:', currentTitle);
        if (!newTitle || newTitle.trim() === currentTitle) return;

        try {
            await fetch(`/api/conversations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle.trim() }),
            });
            await loadConversations();

            if (id === activeConversationId) {
                document.getElementById('chatTitle').textContent = newTitle.trim();
            }
        } catch (err) {
            console.error('Failed to rename:', err);
        }
    }

    async function deleteConversation(id) {
        if (!confirm('Delete this conversation?')) return;

        try {
            await fetch(`/api/conversations/${id}`, { method: 'DELETE' });

            if (id === activeConversationId) {
                activeConversationId = null;
                if (window.NexusChat) {
                    window.NexusChat.clearChat();
                }
            }

            await loadConversations();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    // ── Mobile Sidebar ───────────────────────────────────────────────────

    function openMobileSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebarOverlay').classList.add('active');
    }

    function closeMobileSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
    }

    // ── Settings Modal ───────────────────────────────────────────────────

    async function openSettings() {
        const modal = document.getElementById('settingsModal');
        modal.style.display = 'flex';

        // Load current settings
        try {
            const resp = await fetch('/auth/settings');
            const data = await resp.json();
            const statusEl = document.getElementById('apiKeyStatus');

            if (data.has_api_key) {
                statusEl.textContent = `Current key: ${data.api_key_preview}`;
                statusEl.className = 'api-key-status has-key';
            } else {
                statusEl.textContent = 'No API key set';
                statusEl.className = 'api-key-status';
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    }

    function closeSettingsModal() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    async function saveSettings() {
        const apiKey = document.getElementById('apiKeyInput').value.trim();

        if (apiKey) {
            try {
                const resp = await fetch('/auth/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: apiKey }),
                });
                const data = await resp.json();

                if (data.success) {
                    const statusEl = document.getElementById('apiKeyStatus');
                    statusEl.textContent = 'API key saved successfully!';
                    statusEl.className = 'api-key-status has-key';
                    document.getElementById('apiKeyInput').value = '';
                }
            } catch (err) {
                console.error('Failed to save settings:', err);
                alert('Failed to save settings.');
            }
        }

        closeSettingsModal();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ── Expose ───────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', init);

    window.NexusSidebar = {
        getActiveConversationId: () => activeConversationId,
        setActiveConversationId: (id) => { activeConversationId = id; },
        loadConversations,
        createNewChat,
    };
})();
