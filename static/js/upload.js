/**
 * Upload Manager — Handles file (PDF, DOCX, TXT) and image uploads.
 */
(function() {
    'use strict';

    let currentUpload = null;  // { type: 'document'|'image', filename, text?, image_data? }

    function init() {
        const uploadBtn = document.getElementById('uploadBtn');
        const imageBtn = document.getElementById('imageBtn');
        const fileInput = document.getElementById('fileInput');
        const imageInput = document.getElementById('imageInput');
        const uploadPreview = document.getElementById('uploadPreview');
        const uploadPreviewContent = document.getElementById('uploadPreviewContent');
        const uploadRemove = document.getElementById('uploadRemove');

        if (!uploadBtn || !fileInput) return;

        // File upload button
        uploadBtn.addEventListener('click', () => fileInput.click());
        imageBtn.addEventListener('click', () => imageInput.click());

        // File selected
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await handleUpload(file);
            fileInput.value = '';
        });

        // Image selected
        imageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await handleUpload(file);
            imageInput.value = '';
        });

        // Remove upload
        uploadRemove.addEventListener('click', () => {
            clearUpload();
        });
    }

    async function handleUpload(file) {
        const uploadPreview = document.getElementById('uploadPreview');
        const uploadPreviewContent = document.getElementById('uploadPreviewContent');

        // Show loading state
        uploadPreviewContent.innerHTML = `
            <div>
                <div class="upload-filename">${escapeHtml(file.name)}</div>
                <div class="upload-type">Uploading...</div>
            </div>
        `;
        uploadPreview.style.display = 'flex';

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            currentUpload = data;

            // Update preview
            if (data.type === 'image') {
                uploadPreviewContent.innerHTML = `
                    <img src="data:${data.image_data.mime_type};base64,${data.image_data.data}" alt="Upload preview">
                    <div>
                        <div class="upload-filename">${escapeHtml(data.filename)}</div>
                        <div class="upload-type">Image</div>
                    </div>
                `;
            } else {
                const textPreview = data.text.substring(0, 100) + (data.text.length > 100 ? '...' : '');
                uploadPreviewContent.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div>
                        <div class="upload-filename">${escapeHtml(data.filename)}</div>
                        <div class="upload-type">${escapeHtml(textPreview)}</div>
                    </div>
                `;
            }
        } catch (err) {
            clearUpload();
            alert('Upload failed: ' + err.message);
        }
    }

    function clearUpload() {
        currentUpload = null;
        const uploadPreview = document.getElementById('uploadPreview');
        if (uploadPreview) {
            uploadPreview.style.display = 'none';
        }
    }

    function getUpload() {
        return currentUpload;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    document.addEventListener('DOMContentLoaded', init);

    // Expose globally
    window.NexusUpload = { getUpload, clearUpload };
})();
