/**
 * Text-to-Speech Module
 * Handles audio playback using Web Speech API
 */

const TTS = {
    synth: window.speechSynthesis,
    utterance: null,
    isPlaying: false,
    isPaused: false,
    currentPosition: 0, // in seconds (estimated)
    totalDuration: 0,   // in seconds (estimated)
    text: '',
    sentences: [],
    currentSentenceIndex: 0,
    rate: 1.0,
    progressInterval: null,
    saveProgressCallback: null,
    onEndCallback: null,
    onProgressCallback: null,
    savedPosition: 0,        // for pause/resume
    savedSentenceIndex: 0,   // for pause/resume

    /**
     * Initialize TTS with text content
     * @param {string} text - Text to speak
     * @param {object} callbacks - Callback functions
     */
    init(text, callbacks = {}) {
        this.stop();

        this.text = text;
        this.sentences = Parser.splitIntoSentences(text);
        this.currentSentenceIndex = 0;
        this.currentPosition = 0;
        this.rate = Storage.getTTSRate();
        this.totalDuration = Parser.estimateTTSDuration(text, this.rate);

        this.saveProgressCallback = callbacks.onSaveProgress || null;
        this.onEndCallback = callbacks.onEnd || null;
        this.onProgressCallback = callbacks.onProgress || null;

        // Get available voices (helps with some browsers)
        this.synth.getVoices();
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

        this.speakFromIndex(this.currentSentenceIndex);
        this.startProgressTracking();
    },

    /**
     * Speak from a specific sentence index
     * @param {number} index - Sentence index
     */
    speakFromIndex(index) {
        if (index >= this.sentences.length) {
            this.handleEnd();
            return;
        }

        this.currentSentenceIndex = index;

        // Get remaining text from current sentence
        const remainingText = this.sentences.slice(index).join(' ');

        this.utterance = new SpeechSynthesisUtterance(remainingText);
        this.utterance.rate = this.rate;
        this.utterance.pitch = 1.0;

        // Try to use a good English voice
        const voices = this.synth.getVoices();
        const preferredVoice = voices.find(v =>
            v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Natural'))
        ) || voices.find(v => v.lang.startsWith('en'));

        if (preferredVoice) {
            this.utterance.voice = preferredVoice;
        }

        this.utterance.onend = () => {
            if (this.isPlaying && !this.isPaused) {
                this.handleEnd();
            }
        };

        this.utterance.onerror = (event) => {
            if (event.error !== 'interrupted' && event.error !== 'canceled') {
                console.error('TTS error:', event.error);
            }
        };

        this.utterance.onboundary = (event) => {
            // Update position based on character index (approximate)
            if (event.name === 'sentence') {
                this.currentSentenceIndex++;
                this.updatePositionFromSentence();
            }
        };

        this.synth.speak(this.utterance);
    },

    /**
     * Pause playback
     * Note: iOS Safari has issues with synth.pause(), so we cancel and save position
     */
    pause() {
        if (!this.isPlaying) return;

        // Save current position before stopping
        this.savedPosition = this.currentPosition;
        this.savedSentenceIndex = this.currentSentenceIndex;

        // Set flags BEFORE cancel to prevent onend handler from running
        this.isPaused = true;
        this.isPlaying = false;
        this.stopProgressTracking();

        this.synth.cancel();
    },

    /**
     * Resume playback
     * Note: iOS Safari has issues with synth.resume(), so we restart from saved position
     */
    resume() {
        if (!this.isPaused) return;

        this.isPaused = false;
        this.isPlaying = true;

        // Restore position and restart
        if (this.savedSentenceIndex !== undefined) {
            this.currentSentenceIndex = this.savedSentenceIndex;
            this.currentPosition = this.savedPosition || 0;
        }

        this.speakFromIndex(this.currentSentenceIndex);
        this.startProgressTracking();
    },

    /**
     * Stop playback completely
     */
    stop() {
        // Set flags BEFORE cancel to prevent onend handler from running
        this.isPlaying = false;
        this.isPaused = false;
        this.stopProgressTracking();

        this.synth.cancel();
    },

    /**
     * Skip forward by seconds
     * @param {number} seconds - Seconds to skip
     */
    skipForward(seconds = CONFIG.SKIP_DURATION) {
        const wasPlaying = this.isPlaying;
        this.stop();

        // Estimate new position
        const newPosition = Math.min(this.currentPosition + seconds, this.totalDuration);
        this.seekToPosition(newPosition);

        if (wasPlaying) {
            this.play();
        }
    },

    /**
     * Skip backward by seconds
     * @param {number} seconds - Seconds to skip
     */
    skipBackward(seconds = CONFIG.SKIP_DURATION) {
        const wasPlaying = this.isPlaying;
        this.stop();

        // Estimate new position
        const newPosition = Math.max(this.currentPosition - seconds, 0);
        this.seekToPosition(newPosition);

        if (wasPlaying) {
            this.play();
        }
    },

    /**
     * Seek to a specific position (in seconds)
     * @param {number} seconds - Position in seconds
     */
    seekToPosition(seconds) {
        this.currentPosition = seconds;

        // Calculate which sentence to start from
        if (this.sentences.length > 0 && this.totalDuration > 0) {
            const avgSentenceDuration = this.totalDuration / this.sentences.length;
            this.currentSentenceIndex = Math.floor(seconds / avgSentenceDuration);
            this.currentSentenceIndex = Math.max(0, Math.min(this.currentSentenceIndex, this.sentences.length - 1));
        } else {
            this.currentSentenceIndex = 0;
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

        // Recalculate duration
        this.totalDuration = Parser.estimateTTSDuration(this.text, this.rate);

        // If playing, restart from current position with new rate
        if (this.isPlaying) {
            // Save position, stop, and restart
            const savedPos = this.currentPosition;
            const savedIdx = this.currentSentenceIndex;

            this.isPlaying = false;
            this.isPaused = false;
            this.stopProgressTracking();
            this.synth.cancel();

            // Restart with saved position
            this.currentPosition = savedPos;
            this.currentSentenceIndex = savedIdx;
            this.isPlaying = true;
            this.speakFromIndex(this.currentSentenceIndex);
            this.startProgressTracking();
        }
        // If paused, just update the rate - it will use new rate on resume
    },

    /**
     * Cycle through available rates
     * @returns {number} New rate
     */
    cycleRate() {
        const rates = CONFIG.TTS_RATES;
        // Find closest rate index (handles floating point comparison)
        let currentIndex = rates.findIndex(r => Math.abs(r - this.rate) < 0.01);
        if (currentIndex === -1) currentIndex = 0;
        const nextIndex = (currentIndex + 1) % rates.length;
        const newRate = rates[nextIndex];
        this.setRate(newRate);
        return newRate;
    },

    /**
     * Update position estimate based on current sentence
     */
    updatePositionFromSentence() {
        if (this.sentences.length > 0 && this.totalDuration > 0) {
            const avgSentenceDuration = this.totalDuration / this.sentences.length;
            this.currentPosition = this.currentSentenceIndex * avgSentenceDuration;
        }
        this.notifyProgress();
    },

    /**
     * Start progress tracking interval
     */
    startProgressTracking() {
        this.stopProgressTracking();

        // Update position estimate every second
        this.progressInterval = setInterval(() => {
            if (this.isPlaying && !this.isPaused) {
                // Increment position based on rate
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
                isPaused: this.isPaused
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
            percent: this.getProgressPercent()
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
