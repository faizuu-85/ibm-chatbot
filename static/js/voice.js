/**
 * Voice Input — Web Speech API integration for voice-to-text.
 */
(function() {
    'use strict';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    let recognition = null;
    let isRecording = false;

    function init() {
        const voiceBtn = document.getElementById('voiceBtn');
        if (!voiceBtn) return;

        if (!SpeechRecognition) {
            voiceBtn.title = 'Voice input not supported in this browser';
            voiceBtn.style.opacity = '0.3';
            voiceBtn.style.cursor = 'not-allowed';
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            voiceBtn.classList.add('recording');
            voiceBtn.title = 'Click to stop recording';
        };

        recognition.onend = () => {
            isRecording = false;
            voiceBtn.classList.remove('recording');
            voiceBtn.title = 'Voice input';
        };

        recognition.onresult = (event) => {
            const chatInput = document.getElementById('chatInput');
            if (!chatInput) return;

            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }

            // Use the final result
            if (event.results[event.results.length - 1].isFinal) {
                // Append to existing text
                const currentText = chatInput.value;
                chatInput.value = currentText
                    ? currentText + ' ' + transcript
                    : transcript;

                // Trigger input event for auto-resize and send button
                chatInput.dispatchEvent(new Event('input'));
                chatInput.focus();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isRecording = false;
            voiceBtn.classList.remove('recording');

            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please allow microphone permissions.');
            }
        };

        voiceBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);

    window.NexusVoice = { isRecording: () => isRecording };
})();
