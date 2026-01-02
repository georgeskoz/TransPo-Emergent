/**
 * Audio Notification Service for Transpo
 * Handles playing looping notification sounds for ride alerts
 */

class AudioNotificationService {
  constructor() {
    this.audio = null;
    this.isPlaying = false;
    this.audioContext = null;
    this.oscillator = null;
    this.gainNode = null;
    this.loopInterval = null;
    
    // Initialize audio context on user interaction
    this.initAudioContext();
  }

  /**
   * Initialize Web Audio API context
   */
  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported, falling back to HTML5 Audio');
    }
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Generate a notification beep using Web Audio API
   * Creates a pleasant two-tone alert sound
   */
  playBeepPattern() {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    
    // First beep (higher pitch)
    this.playTone(880, now, 0.15, 0.3); // A5
    
    // Second beep (lower pitch)
    this.playTone(659, now + 0.2, 0.15, 0.3); // E5
    
    // Third beep (higher pitch again)
    this.playTone(880, now + 0.4, 0.15, 0.3); // A5
  }

  /**
   * Play a single tone
   */
  playTone(frequency, startTime, duration, volume = 0.3) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    // Envelope for smooth sound
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  /**
   * Play urgent ride alert sound (loops until stopped)
   * Uses a combination of beeps that sound like a taxi meter
   */
  async playRideAlert() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    
    try {
      await this.resumeContext();
      
      // Play immediately
      this.playBeepPattern();
      
      // Loop every 2 seconds
      this.loopInterval = setInterval(() => {
        if (this.isPlaying) {
          this.playBeepPattern();
          // Also vibrate if supported
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
        }
      }, 2000);
      
      console.log('🔊 Ride alert sound started');
      
    } catch (error) {
      console.error('Error playing ride alert:', error);
      // Fallback to HTML5 Audio with a generated beep
      this.playFallbackAlert();
    }
  }

  /**
   * Fallback using HTML5 Audio with a data URL beep
   */
  playFallbackAlert() {
    // Create a simple beep using oscillator data
    const sampleRate = 8000;
    const duration = 0.3;
    const frequency = 800;
    const samples = sampleRate * duration;
    
    // Generate WAV header and data
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples * 2, true);
    
    // Generate sine wave
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const amplitude = Math.sin(2 * Math.PI * frequency * t) * 0.3;
      const envelope = Math.min(1, Math.min(t * 20, (duration - t) * 20));
      view.setInt16(44 + i * 2, amplitude * envelope * 32767, true);
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    this.audio = new Audio(url);
    this.audio.loop = false;
    
    const playLoop = () => {
      if (this.isPlaying && this.audio) {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      }
    };
    
    this.audio.onended = () => {
      if (this.isPlaying) {
        setTimeout(playLoop, 500);
      }
    };
    
    playLoop();
    
    // Also set up interval for vibration
    this.loopInterval = setInterval(() => {
      if (this.isPlaying && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    }, 2000);
  }

  /**
   * Stop the ride alert sound
   */
  stopRideAlert() {
    this.isPlaying = false;
    
    // Stop the loop interval
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    
    // Stop HTML5 Audio if used
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    
    // Stop vibration
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
    
    console.log('🔇 Ride alert sound stopped');
  }

  /**
   * Play a short success sound (when ride is accepted)
   */
  playSuccessSound() {
    if (!this.audioContext) return;
    
    this.resumeContext().then(() => {
      const now = this.audioContext.currentTime;
      // Pleasant ascending tones
      this.playTone(523, now, 0.1, 0.2);       // C5
      this.playTone(659, now + 0.1, 0.1, 0.2); // E5
      this.playTone(784, now + 0.2, 0.2, 0.2); // G5
    });
  }

  /**
   * Play a short decline sound
   */
  playDeclineSound() {
    if (!this.audioContext) return;
    
    this.resumeContext().then(() => {
      const now = this.audioContext.currentTime;
      // Short low tone
      this.playTone(330, now, 0.15, 0.15); // E4
    });
  }

  /**
   * Play a "ride taken" notification sound
   */
  playRideTakenSound() {
    if (!this.audioContext) return;
    
    this.resumeContext().then(() => {
      const now = this.audioContext.currentTime;
      // Descending tones
      this.playTone(659, now, 0.1, 0.15);       // E5
      this.playTone(523, now + 0.15, 0.15, 0.15); // C5
    });
  }

  /**
   * Check if audio is currently playing
   */
  isAlertPlaying() {
    return this.isPlaying;
  }
}

// Create singleton instance
const audioService = new AudioNotificationService();

export default audioService;

// Named exports for convenience
export const playRideAlert = () => audioService.playRideAlert();
export const stopRideAlert = () => audioService.stopRideAlert();
export const playSuccessSound = () => audioService.playSuccessSound();
export const playDeclineSound = () => audioService.playDeclineSound();
export const playRideTakenSound = () => audioService.playRideTakenSound();
export const isAlertPlaying = () => audioService.isAlertPlaying();
