/**
 * Text-to-Speech Module
 * Handles audio playback using Web Speech API with chunk-based pauses
 */

const TTS = {
    synth: window.speechSynthesis,
    utterance: null,
    isPlaying: false,
    isPaused: false,
    currentPosition: 0,     // in seconds (estimated)
    totalDuration: 0,       // in seconds (estimated)
    chunks: [],             // parsed chunks with pause info
    currentChunkIndex: 0,
    rate: 1.0,
    voice: null,            // selected voice
    availableVoices: [],    // filtered available voices
    progressInterval: null,
    pauseTimeout: null,     // timeout for pauses between chunks
    saveProgressCallback: null,
    onEndCallback: null,
    onProgressCallback: null,
    onVoicesChangedCallback: null,
    savedPosition: 0,
    savedChunkIndex: 0,
    wakeLock: null,         // screen wake lock
    rawContent: '',         // raw content for re-parsing
    fileName: '',           // file name for parsing

    /**
     * Initialize TTS with content
     * @param {string} rawContent - Raw content (markdown/text)
     * @param {string} fileName - File name to determine type
     * @param {object} callbacks - Callback functions
     */
    init(rawContent, fileName, callbacks = {}) {
        this.stop();

        this.rawContent = rawContent;
        this.fileName = fileName;
        this.chunks = Parser.parseIntoChunks(rawContent, fileName);
        this.currentChunkIndex = 0;
        this.currentPosition = 0;
        this.rate = Storage.getTTSRate();
        this.totalDuration = Parser.estimateChunksDuration(this.chunks, this.rate);

        // Reset voice to ensure fresh selection
        this.voice = null;

        this.saveProgressCallback = callbacks.onSaveProgress || null;
        this.onEndCallback = callbacks.onEnd || null;
        this.onProgressCallback = callbacks.onProgress || null;
        this.onVoicesChangedCallback = callbacks.onVoicesChanged || null;

        // Initialize voices
        this.initVoices();
    },

    /**
     * Initialize voice selection
     */
    initVoices() {
        // Load voices (may be async)
        const loadVoices = () => {
            const allVoices = this.synth.getVoices();

            // Filter out excluded voices and non-allowed languages
            this.availableVoices = allVoices.filter(v => {
                // Normalize language code for comparison (handle en-US, en_US, en-us)
                const voiceLang = v.lang.replace('_', '-').toLowerCase();
                const allowedLangs = (CONFIG.TTS_ALLOWED_LANGS || ['en-US'])
                    .map(l => l.replace('_', '-').toLowerCase());

                if (!allowedLangs.includes(voiceLang)) return false;

                // Check against excluded voices
                const nameLower = v.name.toLowerCase();
                for (const excluded of CONFIG.TTS_EXCLUDED_VOICES) {
                    if (nameLower.includes(excluded.toLowerCase())) {
                        return false;
                    }
                }
                return true;
            });

            // Debug: log available voices to console
            console.log('Available voices after filter:', this.availableVoices.map(v => `${v.name} (${v.lang})`));
            console.log('All voices:', allVoices.map(v => `${v.name} (${v.lang})`));

            // Sort by preference
            this.availableVoices.sort((a, b) => {
                const aScore = this.getVoiceScore(a);
                const bScore = this.getVoiceScore(b);
                return bScore - aScore;
            });

            // Try to restore saved voice
            const savedVoiceName = Storage.getTTSVoice();
            if (savedVoiceName) {
                const savedVoice = this.availableVoices.find(v => v.name === savedVoiceName);
                if (savedVoice) {
                    this.voice = savedVoice;
                }
            }

            // If no saved voice or saved voice not available, use best available
            if (!this.voice && this.availableVoices.length > 0) {
                this.voice = this.availableVoices[0];
            }

            // Notify listeners
            if (this.onVoicesChangedCallback) {
                this.onVoicesChangedCallback(this.availableVoices, this.voice);
            }
        };

        // Voices may not be immediately available
        if (this.synth.getVoices().length > 0) {
            loadVoices();
        } else {
            this.synth.addEventListener('voiceschanged', loadVoices, { once: true });
        }
    },

    /**
     * Get preference score for a voice (higher is better)
     * @param {SpeechSynthesisVoice} voice - Voice to score
     * @returns {number} Score
     */
    getVoiceScore(voice) {
        const nameLower = voice.name.toLowerCase();
        let score = 0;

        // Check against preferred voices (in order)
        const preferred = CONFIG.TTS_PREFERRED_VOICES;
        for (let i = 0; i < preferred.length; i++) {
            if (nameLower.includes(preferred[i].toLowerCase())) {
                score += (preferred.length - i) * 10;
                break;
            }
        }

        // Prefer local voices (usually better quality)
        if (voice.localService) {
            score += 5;
        }

        return score;
    },

    /**
     * Get available voices
     * @returns {Array} Available voices
     */
    getVoices() {
        return this.availableVoices;
    },

    /**
     * Get current voice
     * @returns {SpeechSynthesisVoice|null} Current voice
     */
    getVoice() {
        return this.voice;
    },

    /**
     * Set voice
     * @param {string} voiceName - Voice name
     */
    setVoice(voiceName) {
        const newVoice = this.availableVoices.find(v => v.name === voiceName);
        if (newVoice) {
            this.voice = newVoice;
            Storage.saveTTSVoice(voiceName);

            // If playing, restart with new voice
            if (this.isPlaying) {
                const savedIdx = this.currentChunkIndex;
                const savedPos = this.currentPosition;

                this.stopInternal();

                this.currentChunkIndex = savedIdx;
                this.currentPosition = savedPos;
                this.isPlaying = true;
                this.speakChunk(this.currentChunkIndex);
                this.startProgressTracking();
            }
        }
    },

    /**
     * Request screen wake lock
     */
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                this.wakeLock.addEventListener('release', () => {
                    this.wakeLock = null;
                });
            } catch (err) {
                console.log('Wake lock request failed:', err.message);
            }
        }
    },

    /**
     * Release screen wake lock
     */
    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
    },

    /**
     * Start or resume playback
     */
    play() {
        if (this.isPaused) {
            this.resume();
            return;
        }

        if (this.isPlaying) return;

        this.isPlaying = true;
        this.isPaused = false;

        this.requestWakeLock();
        this.speakChunk(this.currentChunkIndex);
        this.startProgressTracking();
    },

    /**
     * Speak a specific chunk
     * @param {number} index - Chunk index
     */
    speakChunk(index) {
        if (index >= this.chunks.length) {
            this.handleEnd();
            return;
        }

        if (!this.isPlaying || this.isPaused) {
            return;
        }

        this.currentChunkIndex = index;
        const chunk = this.chunks[index];

        this.utterance = new SpeechSynthesisUtterance(chunk.text);
        this.utterance.rate = this.rate;
        this.utterance.pitch = 1.0;

        if (this.voice) {
            this.utterance.voice = this.voice;
        }

        this.utterance.onend = () => {
            if (this.isPlaying && !this.isPaused) {
                // Wait for pause duration then speak next chunk
                this.pauseTimeout = setTimeout(() => {
                    this.speakChunk(index + 1);
                }, chunk.pauseAfter / this.rate); // Adjust pause by rate
            }
        };

        this.utterance.onerror = (event) => {
            if (event.error !== 'interrupted' && event.error !== 'canceled') {
                console.error('TTS error:', event.error);
                // Try to continue with next chunk
                if (this.isPlaying && !this.isPaused) {
                    this.pauseTimeout = setTimeout(() => {
                        this.speakChunk(index + 1);
                    }, 100);
                }
            }
        };

        this.synth.speak(this.utterance);
    },

    /**
     * Pause playback
     */
    pause() {
        if (!this.isPlaying) return;

        // Clear any pending pause timeout
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
            this.pauseTimeout = null;
        }

        // Save current position
        this.savedPosition = this.currentPosition;
        this.savedChunkIndex = this.currentChunkIndex;

        this.isPaused = true;
        this.isPlaying = false;
        this.stopProgressTracking();
        this.releaseWakeLock();

        this.synth.cancel();
    },

    /**
     * Resume playback
     */
    resume() {
        if (!this.isPaused) return;

        this.isPaused = false;
        this.isPlaying = true;

        // Restore position
        if (this.savedChunkIndex !== undefined) {
            this.currentChunkIndex = this.savedChunkIndex;
            this.currentPosition = this.savedPosition || 0;
        }

        this.requestWakeLock();
        this.speakChunk(this.currentChunkIndex);
        this.startProgressTracking();
    },

    /**
     * Stop playback completely (internal - doesn't release wake lock)
     */
    stopInternal() {
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
            this.pauseTimeout = null;
        }

        this.isPlaying = false;
        this.isPaused = false;
        this.stopProgressTracking();

        this.synth.cancel();
    },

    /**
     * Stop playback completely
     */
    stop() {
        this.stopInternal();
        this.releaseWakeLock();
    },

    /**
     * Skip forward by seconds
     * @param {number} seconds - Seconds to skip
     */
    skipForward(seconds = CONFIG.SKIP_DURATION) {
        const wasPlaying = this.isPlaying;
        this.stopInternal();

        const newPosition = Math.min(this.currentPosition + seconds, this.totalDuration);
        this.seekToPosition(newPosition);

        if (wasPlaying) {
            this.isPlaying = true;
            this.speakChunk(this.currentChunkIndex);
            this.startProgressTracking();
        }
    },

    /**
     * Skip backward by seconds
     * @param {number} seconds - Seconds to skip
     */
    skipBackward(seconds = CONFIG.SKIP_DURATION) {
        const wasPlaying = this.isPlaying;
        this.stopInternal();

        const newPosition = Math.max(this.currentPosition - seconds, 0);
        this.seekToPosition(newPosition);

        if (wasPlaying) {
            this.isPlaying = true;
            this.speakChunk(this.currentChunkIndex);
            this.startProgressTracking();
        }
    },

    /**
     * Seek to a specific position (in seconds)
     * @param {number} seconds - Position in seconds
     */
    seekToPosition(seconds) {
        this.currentPosition = seconds;

        if (this.chunks.length > 0 && this.totalDuration > 0) {
            // Calculate which chunk we're in based on position
            const percent = seconds / this.totalDuration;
            this.currentChunkIndex = Math.floor(percent * this.chunks.length);
            this.currentChunkIndex = Math.max(0, Math.min(this.currentChunkIndex, this.chunks.length - 1));
        } else {
            this.currentChunkIndex = 0;
        }

        this.notifyProgress();
    },

    /**
     * Seek to percentage
     * @param {number} percent - Percentage (0-100)
     */
    seekToPercent(percent) {
        const seconds = (percent / 100) * this.totalDuration;
        this.seekToPosition(seconds);
    },

    /**
     * Set playback rate
     * @param {number} rate - Playback rate
     */
    setRate(rate) {
        this.rate = rate;
        Storage.saveTTSRate(rate);

        // Recalculate duration with new rate
        this.totalDuration = Parser.estimateChunksDuration(this.chunks, this.rate);

        // If playing, restart with new rate
        if (this.isPlaying) {
            const savedIdx = this.currentChunkIndex;
            const savedPos = this.currentPosition;

            this.stopInternal();

            this.currentChunkIndex = savedIdx;
            this.currentPosition = savedPos;
            this.isPlaying = true;
            this.speakChunk(this.currentChunkIndex);
            this.startProgressTracking();
        }
    },

    /**
     * Cycle through available rates
     * @returns {number} New rate
     */
    cycleRate() {
        const rates = CONFIG.TTS_RATES;
        let currentIndex = rates.findIndex(r => Math.abs(r - this.rate) < 0.01);
        if (currentIndex === -1) currentIndex = 0;
        const nextIndex = (currentIndex + 1) % rates.length;
        const newRate = rates[nextIndex];
        this.setRate(newRate);
        return newRate;
    },

    /**
     * Start progress tracking interval
     */
    startProgressTracking() {
        this.stopProgressTracking();

        // Update position estimate every second
        this.progressInterval = setInterval(() => {
            if (this.isPlaying && !this.isPaused) {
                this.currentPosition += 1;

                if (this.currentPosition >= this.totalDuration) {
                    this.currentPosition = this.totalDuration;
                }

                this.notifyProgress();
            }
        }, 1000);

        // Save progress periodically
        this.saveInterval = setInterval(() => {
            this.saveProgress();
        }, CONFIG.PROGRESS_SAVE_INTERVAL);
    },

    /**
     * Stop progress tracking interval
     */
    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
    },

    /**
     * Notify progress callback
     */
    notifyProgress() {
        if (this.onProgressCallback) {
            this.onProgressCallback({
                currentPosition: this.currentPosition,
                totalDuration: this.totalDuration,
                percent: this.getProgressPercent(),
                rate: this.rate,
                isPlaying: this.isPlaying,
                isPaused: this.isPaused,
                currentChunk: this.currentChunkIndex,
                totalChunks: this.chunks.length
            });
        }
    },

    /**
     * Save current progress
     */
    saveProgress() {
        if (this.saveProgressCallback) {
            this.saveProgressCallback(this.currentPosition, this.totalDuration);
        }
    },

    /**
     * Handle playback end
     */
    handleEnd() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPosition = this.totalDuration;
        this.stopProgressTracking();
        this.releaseWakeLock();
        this.notifyProgress();

        if (this.onEndCallback) {
            this.onEndCallback();
        }
    },

    /**
     * Get current progress percentage
     * @returns {number} Progress percentage (0-100)
     */
    getProgressPercent() {
        if (this.totalDuration === 0) return 0;
        return Math.round((this.currentPosition / this.totalDuration) * 100);
    },

    /**
     * Format seconds to MM:SS
     * @param {number} seconds - Seconds
     * @returns {string} Formatted time
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Get current state
     * @returns {object} State object
     */
    getState() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentPosition: this.currentPosition,
            totalDuration: this.totalDuration,
            rate: this.rate,
            percent: this.getProgressPercent(),
            voice: this.voice ? this.voice.name : null
        };
    },

    /**
     * Restore position from saved progress
     * @param {number} position - Position in seconds
     */
    restorePosition(position) {
        this.seekToPosition(position);
    }
};
