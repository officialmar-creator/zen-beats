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
  private binauralBaseFreq = 200;

  private natureNodes: Map<NatureSound, { 
    source?: AudioBufferSourceNode; 
    filter?: BiquadFilterNode; 
    mod?: GainNode;
    lfo?: OscillatorNode; 
    lfoGain?: GainNode;
    timer?: number; 
    breezeSource?: AudioBufferSourceNode;
    internalGain?: GainNode;
  }> = new Map();
  
  private colorNoiseNode: AudioBufferSourceNode | null = null;
  private colorNoiseGain: GainNode | null = null;

  // Persistence elements
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
  private htmlAudioElement: HTMLAudioElement | null = null;
  private silentLoop: HTMLAudioElement | null = null;

  private readonly FADE_TIME = 0.15; // 150ms for smooth transitions

  constructor() {
    this.handleVisibility = this.handleVisibility.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private handleVisibility() {
    if (document.visibilityState === 'visible') {
      this.resumeIfSuspended().catch(console.error);
    }
  }

  init() {
    if (this.ctx) return;
    
    // Auto-detect best sample rate for device to prevent crackling
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'playback'
    });

    // Strategy 1: MediaStream Routing
    this.mediaStreamDestination = this.ctx.createMediaStreamDestination();
    this.htmlAudioElement = new Audio();
    this.htmlAudioElement.srcObject = this.mediaStreamDestination.stream;
    this.htmlAudioElement.setAttribute('playsinline', 'true');
    this.htmlAudioElement.style.display = 'none';
    document.body.appendChild(this.htmlAudioElement);

    // Strategy 2: Silent MP3 Loop (The most reliable trick for iOS lock-screen)
    // 1-second silent MP3
    this.silentLoop = new Audio('data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFhYAAAAEAAAAL3NpbGVudC1hdWRpby8v//uQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcea406AAAAAD//7kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcea406AAAAAD//7kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcea406AAAAAD');
    this.silentLoop.loop = true;
    this.silentLoop.volume = 0.01;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(25, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0001;
    
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
    this.compressor.connect(this.mediaStreamDestination);
    
    this.binauralGain = this.ctx.createGain();
    this.binauralGain.connect(this.masterGain);
    
    this.natureGain = this.ctx.createGain();
    this.natureGain.connect(this.masterGain);

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.connect(this.masterGain);

    this.setupMediaSession();
  }

  private setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'ZenBeats Meditation',
        artist: '5Hz Theta Session',
        artwork: [{ src: 'https://images.unsplash.com/photo-1552728089-57bdde30937c?w=512&h=512&fit=crop', sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', () => this.resumeIfSuspended());
      navigator.mediaSession.setActionHandler('pause', () => this.stop());
    }
  }

  async resumeIfSuspended() {
    if (!this.ctx) this.init();
    if (this.ctx!.state === 'suspended') {
      await this.ctx!.resume();
    }
    if (this.htmlAudioElement && this.htmlAudioElement.paused) {
      await this.htmlAudioElement.play().catch(() => {});
    }
    if (this.silentLoop && this.silentLoop.paused) {
      await this.silentLoop.play().catch(() => {});
    }
  }

  setBinauralVolume(val: number) {
    if (this.binauralGain && this.ctx) {
      const target = Math.max(0.0001, val * 0.4);
      const now = this.ctx.currentTime;
      this.binauralGain.gain.setTargetAtTime(target, now, this.FADE_TIME);
    }
  }

  setMasterVolume(val: number) {
    if (this.masterGain && this.ctx) {
      const target = Math.max(0.0001, Math.min(val, 0.9));
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(target, now, this.FADE_TIME);
    }
  }

  setNatureVolume(val: number) {
    if (this.natureGain && this.ctx) {
      const target = Math.max(0.0001, val * 0.6);
      const now = this.ctx.currentTime;
      this.natureGain.gain.setTargetAtTime(target, now, this.FADE_TIME);
    }
  }

  setNoiseVolume(val: number) {
    if (this.noiseGain && this.ctx) {
      const target = Math.max(0.0001, val * 0.15);
      const now = this.ctx.currentTime;
      this.noiseGain.gain.setTargetAtTime(target, now, this.FADE_TIME);
    }
  }

  updateFrequency(freq: number) {
    if (this.rightOsc && this.ctx) {
      const now = this.ctx.currentTime;
      this.rightOsc.frequency.exponentialRampToValueAtTime(this.binauralBaseFreq + freq, now + 0.4);
    }
  }

  updateNatures(selectedNatures: NatureSound[]) {
    if (!this.ctx) return;
    this.natureNodes.forEach((node, type) => {
      if (!selectedNatures.includes(type)) {
        this.fadeOutNatureNode(node, type);
      }
    });
    selectedNatures.forEach(n => {
      if (!this.natureNodes.has(n)) this.startNature(n);
    });
  }

  private fadeOutNatureNode(node: any, type: NatureSound) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    if (node.internalGain) {
      node.internalGain.gain.setTargetAtTime(0.0001, now, 0.05);
    }

    setTimeout(() => {
      try { node.source?.stop(); } catch(e) {}
      try { node.breezeSource?.stop(); } catch(e) {}
      try { node.lfo?.stop(); } catch(e) {}
      if (node.timer) window.clearTimeout(node.timer);
      this.natureNodes.delete(type);
    }, 250);
  }

  updateNoise(color: NoiseColor) {
    if (!this.ctx) return;
    
    if (this.colorNoiseGain) {
      const now = this.ctx.currentTime;
      this.colorNoiseGain.gain.setTargetAtTime(0.0001, now, 0.05);
      const oldNode = this.colorNoiseNode;
      setTimeout(() => {
        try { oldNode?.stop(); } catch(e) {}
      }, 250);
    }

    if (color !== NoiseColor.NONE) {
      this.colorNoiseGain = this.ctx.createGain();
      this.colorNoiseGain.gain.value = 0.0001;
      this.colorNoiseNode = this.ctx.createBufferSource();
      this.colorNoiseNode.buffer = this.createNoiseBuffer(color.toLowerCase() as any);
      this.colorNoiseNode.loop = true;
      this.colorNoiseNode.connect(this.colorNoiseGain).connect(this.noiseGain!);
      this.colorNoiseNode.start();
      this.colorNoiseGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.2);
    }
  }

  stop() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(0.0001, now, 0.4);
    
    setTimeout(() => {
      this.cleanupNodes();
      if (this.htmlAudioElement) this.htmlAudioElement.pause();
      if (this.silentLoop) this.silentLoop.pause();
    }, 1200);
    
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }

  private cleanupNodes() {
    try { this.leftOsc?.stop(); } catch(e) {}
    try { this.rightOsc?.stop(); } catch(e) {}
    this.leftOsc = null;
    this.rightOsc = null;
    this.natureNodes.forEach((node, type) => this.fadeOutNatureNode(node, type));
    if (this.colorNoiseNode) {
      try { this.colorNoiseNode.stop(); } catch(e) {}
      this.colorNoiseNode = null;
    }
  }

  async start(natures: NatureSound[], noise: NoiseColor, freq: number, targetMasterVolume: number) {
    await this.resumeIfSuspended();
    this.cleanupNodes();
    
    if (!this.ctx) this.init();
    const now = this.ctx!.currentTime;
    
    this.masterGain!.gain.setValueAtTime(0.0001, now);

    const merger = this.ctx!.createChannelMerger(2);
    this.leftOsc = this.ctx!.createOscillator();
    this.rightOsc = this.ctx!.createOscillator();
    this.leftOsc.frequency.value = this.binauralBaseFreq;
    this.rightOsc.frequency.value = this.binauralBaseFreq + freq;
    
    this.leftOsc.connect(merger, 0, 0);
    this.rightOsc.connect(merger, 0, 1);
    merger.connect(this.binauralGain!);
    
    this.leftOsc.start(now);
    this.rightOsc.start(now);

    this.updateNatures(natures);
    this.updateNoise(noise);
    
    this.masterGain!.gain.setTargetAtTime(Math.max(0.0001, targetMasterVolume), now, 0.8);
    
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  }

  private createNoiseBuffer(type: 'white' | 'pink' | 'brown' | 'green' = 'white') {
    const duration = 12; 
    const bufferSize = duration * this.ctx!.sampleRate;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') {
      let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }
    }

    const crossfadeSamples = Math.floor(0.3 * this.ctx!.sampleRate);
    for (let i = 0; i < crossfadeSamples; i++) {
      const alpha = i / crossfadeSamples;
      output[i] = output[i] * alpha + output[bufferSize - crossfadeSamples + i] * (1 - alpha);
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
    internalGain.gain.value = 0.0001;

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
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start(now);
        break;
      case NatureSound.SEA: 
        filter.type = 'lowpass'; filter.frequency.value = 550; mod.gain.value = 0.28;
        lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.08; 
        lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.25;
        lfo.connect(lfoGain).connect(mod.gain);
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
    internalGain.gain.setTargetAtTime(1.0, now, 0.3);
    this.natureNodes.set(type, { source, filter, mod, lfo, lfoGain, internalGain });
  }

  private startBirdsSoundscape() {
    if (!this.ctx) return;
    
    const internalGain = this.ctx.createGain();
    internalGain.gain.value = 0.0001;
    internalGain.connect(this.natureGain!);

    const breezeSource = this.ctx.createBufferSource();
    breezeSource.buffer = this.createNoiseBuffer('pink');
    breezeSource.loop = true;
    const breezeFilter = this.ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.value = 1100;
    breezeSource.connect(breezeFilter).connect(internalGain);
    breezeSource.start();

    const chirp = () => {
      if (!this.natureNodes.has(NatureSound.BIRDS) || !this.ctx) return;
      
      const now = this.ctx.currentTime;
      const count = 2 + Math.floor(Math.random() * 3); 
      
      for(let i=0; i<count; i++) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const startTime = now + (i * (0.15 + Math.random() * 0.2));
        
        osc.type = 'sine';
        let baseFreq = 3200 + Math.random() * 800;
        osc.frequency.setValueAtTime(baseFreq, startTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq + 800, startTime + 0.15);
        
        g.gain.setValueAtTime(0.0001, startTime);
        g.gain.linearRampToValueAtTime(0.03, startTime + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);
        
        osc.connect(g).connect(internalGain);
        osc.start(startTime);
        osc.stop(startTime + 0.6);
      }
      
      const nextDelay = 4000 + Math.random() * 6000;
      const timer = window.setTimeout(chirp, nextDelay);
      const existing = this.natureNodes.get(NatureSound.BIRDS);
      if (existing) existing.timer = timer;
    };
    
    internalGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.4);
    this.natureNodes.set(NatureSound.BIRDS, { 
      timer: window.setTimeout(chirp, 1500), 
      breezeSource, 
      internalGain 
    });
  }
}

export const audioService = new AudioService();