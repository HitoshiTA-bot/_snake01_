/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundEffects {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private init() {
    if (this.isMuted) return;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute(muted?: boolean) {
    if (muted !== undefined) {
      this.isMuted = muted;
    } else {
      this.isMuted = !this.isMuted;
    }
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  playEat() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      
      osc.frequency.setValueAtTime(350, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
      
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0.001, t + 0.15);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  playSpecialEat() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);
        gain.gain.setValueAtTime(0.12, t + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.001, t + idx * 0.06 + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t + idx * 0.06);
        osc.stop(t + idx * 0.06 + 0.1);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  playMove() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      
      osc.frequency.setValueAtTime(140, t);
      gain.gain.setValueAtTime(0.02, t);
      gain.gain.linearRampToValueAtTime(0.001, t + 0.03);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.03);
    } catch (e) {
      // Squelch background errors for silent frame policy.
    }
  }

  playGameOver() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const notes = [261.63, 196.00, 164.81, 130.81]; // C4 -> G3 -> E3 -> C3
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t + idx * 0.12);
        gain.gain.setValueAtTime(0.15, t + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.001, t + idx * 0.12 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t + idx * 0.12);
        osc.stop(t + idx * 0.12 + 0.25);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  playLevelUp() {
    if (this.isMuted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);
        gain.gain.setValueAtTime(0.15, t + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.001, t + idx * 0.06 + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t + idx * 0.06);
        osc.stop(t + idx * 0.06 + 0.18);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }
}

export const sound = new SoundEffects();
