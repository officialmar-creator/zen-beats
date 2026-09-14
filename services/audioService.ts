import { NatureSound, NoiseColor } from '../types';

class AudioService {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private binauralGain: GainNode | null = null;
  private natureGain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private leftOscGain: GainNode | null = null;
  private rightOscGain: GainNode | null = null;
  private binauralBaseFreq = 200;

  private natureNodes: Map<NatureSound, { 
    source?: AudioBufferSourceNode; 
    filter?: BiquadFilterNode; 
    mod?: GainNode;
    lfo?: OscillatorNode; 
    lfoGain?: GainNode;
    lookaheadTimer?: number;
    internalGain?: GainNode;
    breezeSource?: AudioBufferSourceNode;
  }> = new Map();
  
  private colorNoiseNode: AudioBufferSourceNode | null = null;
  private colorNoiseGain: GainNode | null = null;

  // Persistence and Background Audio elements
  private bgAudio: HTMLAudioElement | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private streamAudio: HTMLAudioElement | null = null;
  private wakeLock: any = null;
  private isPlaying = false;
  private stopTimeout: any = null;

  private readonly TIME_CONSTANT = 0.15; // Natural smoothing constant

  constructor() {
    this.handleVisibility = this.handleVisibility.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility);
      window.addEventListener('pageshow', this.handleVisibility);
      window.addEventListener('focus', this.handleVisibility);
      window.addEventListener('online', this.handleVisibility);
    }
  }

  private handleVisibility() {
    if (this.isPlaying) {
      this.resumeIfSuspended();
      if (document.visibilityState === 'visible') {
        this.requestWakeLock();
      }
    }
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && !this.wakeLock) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      } catch (err) {}
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
        this.wakeLock = null;
      } catch (err) {}
    }
  }

  init() {
    // If context is closed or crashed, reset it cleanly
    if (this.ctx && this.ctx.state === 'closed') {
      this.ctx = null;
      this.leftOsc = null;
      this.rightOsc = null;
    }

    if (this.ctx) return;
    
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new AudioCtx({ latencyHint: 'playback' });

    // Handle OS-level audio interruptions (phone calls, backgrounding, lock screen)
    this.ctx.onstatechange = () => {
      if (this.isPlaying && this.ctx?.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    };

    // Continuous audio element anchor with actual PCM WAV to hold iOS/Android audio session alive
    if (!this.bgAudio && typeof document !== 'undefined') {
      this.bgAudio = document.createElement('audio');
      this.bgAudio.src = '/keepalive.wav';
      this.bgAudio.loop = true;
      this.bgAudio.volume = 0.02; // Non-zero so mobile OS doesn't disregard as silent
      this.bgAudio.setAttribute('playsinline', 'true');
      this.bgAudio.setAttribute('webkit-playsinline', 'true');
      this.bgAudio.setAttribute('preload', 'auto');
      this.bgAudio.style.display = 'none';
      document.body.appendChild(this.bgAudio);
    }

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-20, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0001;
    
    // Route clean single path to destination: master -> compressor -> ctx.destination
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // Route audio to MediaStreamDestination if available for lock-screen hardware stream pipeline
    try {
      if (typeof this.ctx.createMediaStreamDestination === 'function' && !this.streamDest) {
        this.streamDest = this.ctx.createMediaStreamDestination();
        this.masterGain.connect(this.streamDest);
        if (!this.streamAudio && typeof document !== 'undefined') {
          this.streamAudio = document.createElement('audio');
          this.streamAudio.setAttribute('playsinline', 'true');
          this.streamAudio.setAttribute('webkit-playsinline', 'true');
          this.streamAudio.style.display = 'none';
          this.streamAudio.srcObject = this.streamDest.stream;
          document.body.appendChild(this.streamAudio);
        }
      }
    } catch (e) {}
    
    this.binauralGain = this.ctx.createGain();
    this.binauralGain.connect(this.masterGain);
    
    this.natureGain = this.ctx.createGain();
    this.natureGain.connect(this.masterGain);

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.connect(this.masterGain);

    // Persistent Oscillators
    const merger = this.ctx.createChannelMerger(2);
    this.leftOsc = this.ctx.createOscillator();
    this.rightOsc = this.ctx.createOscillator();
    this.leftOscGain = this.ctx.createGain();
    this.rightOscGain = this.ctx.createGain();
    this.leftOscGain.gain.value = 0;
    this.rightOscGain.gain.value = 0;

    // Default to Delta frequency (2Hz difference: 200Hz left, 202Hz right)
    this.leftOsc.frequency.value = this.binauralBaseFreq;
    this.rightOsc.frequency.value = this.binauralBaseFreq + 2;

    this.leftOsc.connect(this.leftOscGain).connect(merger, 0, 0);
    this.rightOsc.connect(this.rightOscGain).connect(merger, 0, 1);
    merger.connect(this.binauralGain);

    try {
      this.leftOsc.start();
      this.rightOsc.start();
    } catch (e) {}

    this.setupMediaSession();
  }

  private setupMediaSession() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'ZenBeats',
        artist: 'Deep Delta & Theta Meditation',
        album: 'Binaural Brainwave Sanctuary',
        artwork: [
          { src: 'https://images.unsplash.com/photo-1552728089-57bdde30937c?w=512&h=512&fit=crop', sizes: '512x512', type: 'image/jpeg' }
        ]
      });
      navigator.mediaSession.setActionHandler('play', () => this.resumeIfSuspended());
      navigator.mediaSession.setActionHandler('pause', () => this.stop());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
    }
  }

  async resumeIfSuspended() {
    if (!this.ctx || this.ctx.state === 'closed') this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {}
    }
    if (this.bgAudio && this.bgAudio.paused && this.isPlaying) {
      this.bgAudio.play().catch(() => {});
    }
    if (this.streamAudio && this.streamAudio.paused && this.isPlaying) {
      this.streamAudio.play().catch(() => {});
    }
  }

  private ramp(param: AudioParam, value: number, immediate: boolean = false) {
    if (!this.ctx || !param || typeof param.setTargetAtTime !== 'function') return;
    const now = this.ctx.currentTime;
    try {
      param.cancelScheduledValues(now);
      if (immediate) {
        param.setValueAtTime(value, now);
      } else {
        const currVal = typeof param.value === 'number' && !isNaN(param.value) ? param.value : value;
        param.setValueAtTime(currVal, now);
        param.setTargetAtTime(value, now, this.TIME_CONSTANT);
      }
    } catch (e) {
      try { param.value = value; } catch(err) {}
    }
  }

  setBinauralVolume(val: number) {
    if (this.binauralGain) this.ramp(this.binauralGain.gain, val * 0.4);
  }

  setMasterVolume(val: number) {
    if (this.masterGain) this.ramp(this.masterGain.gain, Math.max(0.0001, Math.min(val, 0.95)));
  }

  setNatureVolume(val: number) {
    if (this.natureGain) this.ramp(this.natureGain.gain, val * 0.6);
  }

  setNoiseVolume(val: number) {
    if (this.noiseGain) this.ramp(this.noiseGain.gain, val * 0.1);
  }

  updateFrequency(freq: number) {
    if (this.rightOsc && this.ctx) {
      try {
        this.rightOsc.frequency.setTargetAtTime(this.binauralBaseFreq + freq, this.ctx.currentTime, 0.3);
      } catch (e) {
        this.rightOsc.frequency.value = this.binauralBaseFreq + freq;
      }
    }
  }

  updateNatures(selectedNatures: NatureSound[]) {
    if (!this.ctx) return;
    this.natureNodes.forEach((node, type) => {
      if (!selectedNatures.includes(type)) this.fadeOutNatureNode(node, type);
    });
    selectedNatures.forEach(n => {
      if (!this.natureNodes.has(n)) this.startNature(n);
    });
  }

  private fadeOutNatureNode(node: any, type: NatureSound) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (node.internalGain) {
      try { node.internalGain.gain.setTargetAtTime(0, now, 0.1); } catch (e) {}
    }
    if (node.lookaheadTimer) window.clearInterval(node.lookaheadTimer);
    
    setTimeout(() => {
      try { node.source?.stop(); } catch(e) {}
      try { node.lfo?.stop(); } catch(e) {}
      try { node.breezeSource?.stop(); } catch(e) {}
      this.natureNodes.delete(type);
    }, 300);
  }

  updateNoise(color: NoiseColor) {
    if (!this.ctx) return;
    
    if (this.colorNoiseGain) {
      this.ramp(this.colorNoiseGain.gain, 0);
      const oldNode = this.colorNoiseNode;
      setTimeout(() => { try { oldNode?.stop(); } catch(e) {} }, 300);
    }

    if (color !== NoiseColor.NONE) {
      this.colorNoiseGain = this.ctx.createGain();
      this.colorNoiseGain.gain.value = 0;
      this.colorNoiseNode = this.ctx.createBufferSource();
      this.colorNoiseNode.buffer = this.createNoiseBuffer(color.toLowerCase() as any);
      this.colorNoiseNode.loop = true;
      this.colorNoiseNode.connect(this.colorNoiseGain).connect(this.noiseGain!);
      this.colorNoiseNode.start();
      this.ramp(this.colorNoiseGain.gain, 1.0);
    }
  }

  // Plays a resonant Tibetan singing bowl completion chime when session timer finishes
  playCompletionChime() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;
      const chimeGain = this.ctx.createGain();
      chimeGain.gain.setValueAtTime(0.0001, now);
      chimeGain.gain.linearRampToValueAtTime(0.35, now + 0.05);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);
      chimeGain.connect(this.ctx.destination);

      // Solfeggio 528Hz healing fundamental + harmonics
      const frequencies = [264, 528, 1056, 1584];
      const gains = [0.2, 0.4, 0.25, 0.1];

      frequencies.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const oscGain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        oscGain.gain.setValueAtTime(gains[idx], now);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + (3.5 + idx * 0.3));

        osc.connect(oscGain).connect(chimeGain);
        osc.start(now);
        osc.stop(now + 4.5);

        osc.onended = () => {
          try {
            osc.disconnect();
            oscGain.disconnect();
          } catch(e) {}
        };
      });

      setTimeout(() => {
        try { chimeGain.disconnect(); } catch (e) {}
      }, 5000);
    } catch (err) {
      console.warn('Chime playback error:', err);
    }
  }

  stop() {
    this.isPlaying = false;
    this.releaseWakeLock();
    
    // Clear any previous stop timeout
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    if (this.bgAudio) {
      try { this.bgAudio.pause(); } catch(e) {}
    }
    if (this.streamAudio) {
      try { this.streamAudio.pause(); } catch(e) {}
    }

    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    try {
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.3);
    } catch (e) {}
    
    this.stopTimeout = setTimeout(() => {
      // Guard against race condition: don't mute if user restarted
      if (this.isPlaying) return;
      this.mutePermanentOscillators();
      this.natureNodes.forEach((node, type) => this.fadeOutNatureNode(node, type));
      if (this.colorNoiseNode) {
        try { this.colorNoiseNode.stop(); } catch(e) {}
        this.colorNoiseNode = null;
      }
    }, 500);
    
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }

  private mutePermanentOscillators() {
    if (this.leftOscGain) this.ramp(this.leftOscGain.gain, 0, true);
    if (this.rightOscGain) this.ramp(this.rightOscGain.gain, 0, true);
  }

  async start(natures: NatureSound[], noise: NoiseColor, freq: number, targetMasterVolume: number) {
    this.isPlaying = true;

    // Immediately cancel any pending stop timeout
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    await this.resumeIfSuspended();
    if (!this.ctx || this.ctx.state === 'closed') this.init();
    await this.requestWakeLock();

    // Start background lock-screen audio anchor
    if (this.bgAudio) {
      this.bgAudio.currentTime = 0;
      this.bgAudio.play().catch(() => {});
    }
    if (this.streamAudio) {
      this.streamAudio.play().catch(() => {});
    }
    
    // Gate oscillators open
    if (this.leftOscGain) this.ramp(this.leftOscGain.gain, 1.0, true);
    if (this.rightOscGain) this.ramp(this.rightOscGain.gain, 1.0, true);
    
    this.updateFrequency(freq);
    this.updateNatures(natures);
    this.updateNoise(noise);
    
    if (this.masterGain) {
      this.ramp(this.masterGain.gain, targetMasterVolume, false);
    }
    
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  private createNoiseBuffer(type: 'white' | 'pink' | 'brown' | 'green' = 'white') {
    if (!this.ctx) return null as any;
    const duration = 16; 
    const crossfadeDuration = 1.0; 
    const sampleRate = this.ctx.sampleRate;
    const loopSamples = Math.floor(duration * sampleRate);
    const fadeSamples = Math.floor(crossfadeDuration * sampleRate);
    const totalSamples = loopSamples + fadeSamples;

    const raw = new Float32Array(totalSamples);

    if (type === 'white') {
      for (let i = 0; i < totalSamples; i++) {
        raw[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < 44100; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        b6 = white * 0.115926;
      }
      for (let i = 0; i < totalSamples; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      let lastOut = 0.0;
      for (let i = 0; i < 44100; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
      }
      for (let i = 0; i < totalSamples; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        raw[i] = lastOut * 3.5;
      }
    }

    const buffer = this.ctx.createBuffer(1, loopSamples, sampleRate);
    const output = buffer.getChannelData(0);

    const halfPi = Math.PI / 2;
    for (let i = 0; i < loopSamples; i++) {
      if (i < fadeSamples) {
        const progress = i / fadeSamples;
        const fadeIn = Math.sin(progress * halfPi);
        const fadeOut = Math.cos(progress * halfPi);
        output[i] = raw[i] * fadeIn + raw[loopSamples + i] * fadeOut;
      } else {
        output[i] = raw[i];
      }
    }
    
    return buffer;
  }

  private startNature(type: NatureSound) {
    if (type === NatureSound.NONE || !this.ctx) return;
    
    if (type === NatureSound.BIRDS) {
      this.startBirdsSoundscape();
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(type === NatureSound.SEA ? 'brown' : type === NatureSound.WIND ? 'pink' : 'white');
    source.loop = true;
    
    const filter = this.ctx.createBiquadFilter();
    const mod = this.ctx.createGain();
    const internalGain = this.ctx.createGain(); 
    internalGain.gain.value = 0;

    source.connect(filter).connect(mod).connect(internalGain).connect(this.natureGain!);
    
    const now = this.ctx.currentTime;
    let lfo: OscillatorNode | undefined;
    let lfoGain: GainNode | undefined;

    switch (type) {
      case NatureSound.RAIN: 
        filter.type = 'lowpass'; filter.frequency.value = 1400; mod.gain.value = 0.18; 
        break;
      case NatureSound.WIND: 
        filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 1.0; mod.gain.value = 0.25;
        lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.12;
        lfoGain = this.ctx.createGain(); lfoGain.gain.value = 350;
        lfo.connect(lfoGain!);
        lfoGain.connect(filter.frequency);
        lfo.start(now);
        break;
      case NatureSound.SEA: 
        filter.type = 'lowpass'; filter.frequency.value = 550; mod.gain.value = 0.3;
        lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.08; 
        lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.2;
        lfo.connect(lfoGain!);
        lfoGain.connect(mod.gain);
        lfo.start(now);
        break;
      case NatureSound.NIGHT: 
        filter.type = 'highpass'; filter.frequency.value = 5000; mod.gain.value = 0.006;
        break;
      case NatureSound.FOREST: 
        filter.type = 'highpass'; filter.frequency.value = 2500; mod.gain.value = 0.08; 
        break;
    }
    source.start(now);
    this.ramp(internalGain.gain, 1.0);
    this.natureNodes.set(type, { source, filter, mod, lfo, lfoGain, internalGain });
  }

  private startBirdsSoundscape() {
    if (!this.ctx) return;
    
    const internalGain = this.ctx.createGain();
    internalGain.gain.value = 0;
    internalGain.connect(this.natureGain!);

    const breezeSource = this.ctx.createBufferSource();
    breezeSource.buffer = this.createNoiseBuffer('pink');
    breezeSource.loop = true;
    const breezeFilter = this.ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass'; breezeFilter.frequency.value = 1100;
    breezeSource.connect(breezeFilter).connect(internalGain);
    breezeSource.start();

    let nextBirdTime = this.ctx.currentTime + 1;
    const scheduler = () => {
      if (!this.natureNodes.has(NatureSound.BIRDS) || !this.ctx) return;
      
      // Prevent scheduling spike when resuming after backgrounding or sleep
      if (nextBirdTime < this.ctx.currentTime) {
        nextBirdTime = this.ctx.currentTime + 0.3;
      }

      const scheduleWindow = 4; 
      while (nextBirdTime < this.ctx.currentTime + scheduleWindow) {
        const startTime = Math.max(nextBirdTime, this.ctx.currentTime + 0.05);
        const count = 2 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < count; i++) {
          const chirpStart = startTime + (i * (0.2 + Math.random() * 0.3));
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          const freq = 3200 + Math.random() * 1000;
          osc.frequency.setValueAtTime(freq, chirpStart);
          osc.frequency.exponentialRampToValueAtTime(freq + 1000, chirpStart + 0.12);
          
          g.gain.setValueAtTime(0.0001, chirpStart);
          g.gain.linearRampToValueAtTime(0.03, chirpStart + 0.03);
          g.gain.linearRampToValueAtTime(0.0001, chirpStart + 0.4);
          
          osc.connect(g).connect(internalGain);
          osc.start(chirpStart);
          osc.stop(chirpStart + 0.5);

          osc.onended = () => {
            try {
              osc.disconnect();
              g.disconnect();
            } catch(e) {}
          };
        }
        nextBirdTime += 6 + Math.random() * 8;
      }
    };
    
    const lookaheadTimer = window.setInterval(scheduler, 2000);
    this.ramp(internalGain.gain, 1.0);
    this.natureNodes.set(NatureSound.BIRDS, { breezeSource, internalGain, lookaheadTimer });
    scheduler();
  }
}

export const audioService = new AudioService();