
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

  // Persistence elements
  private silentAudio: HTMLAudioElement | null = null;
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
  private outputAudioElement: HTMLAudioElement | null = null;

  private readonly TIME_CONSTANT = 0.15; // Natural smoothing constant

  constructor() {
    this.handleVisibility = this.handleVisibility.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private handleVisibility() {
    if (document.visibilityState === 'visible') {
      this.resumeIfSuspended();
    }
  }

  init() {
    if (this.ctx) return;
    
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new AudioCtx({ latencyHint: 'playback' });

    // 1. SILENT BACKGROUND KICKER
    this.silentAudio = new Audio('data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFhYAAAAEAAAAL3NpbGVudC1hdWRpby8v//uQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcea406AAAAAD//7kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcea406AAAAAD//7kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcea406AAAAAD');
    this.silentAudio.loop = true;
    this.silentAudio.volume = 0.01;

    // 2. EXCLUSIVE MEDIASTREAM ROUTING (The "Static" Fix)
    this.mediaStreamDestination = this.ctx.createMediaStreamDestination();
    this.outputAudioElement = new Audio();
    this.outputAudioElement.srcObject = this.mediaStreamDestination.stream;
    this.outputAudioElement.setAttribute('playsinline', 'true');
    this.outputAudioElement.style.display = 'none';
    document.body.appendChild(this.outputAudioElement);

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-20, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0001;
    
    // Route: EVERYTHING -> MASTER -> COMPRESSOR -> MEDIASTREAM -> OUTPUT AUDIO TAG
    // We explicitly do NOT connect to ctx.destination to avoid hardware clock conflicts on lock-screen
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.mediaStreamDestination);
    
    this.binauralGain = this.ctx.createGain();
    this.binauralGain.connect(this.masterGain);
    
    this.natureGain = this.ctx.createGain();
    this.natureGain.connect(this.masterGain);

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.connect(this.masterGain);

    // Initial Persistent Oscillators (started once, never stopped)
    const merger = this.ctx.createChannelMerger(2);
    this.leftOsc = this.ctx.createOscillator();
    this.rightOsc = this.ctx.createOscillator();
    this.leftOscGain = this.ctx.createGain();
    this.rightOscGain = this.ctx.createGain();
    this.leftOscGain.gain.value = 0;
    this.rightOscGain.gain.value = 0;

    this.leftOsc.frequency.value = this.binauralBaseFreq;
    this.rightOsc.frequency.value = this.binauralBaseFreq + 5;

    this.leftOsc.connect(this.leftOscGain).connect(merger, 0, 0);
    this.rightOsc.connect(this.rightOscGain).connect(merger, 0, 1);
    merger.connect(this.binauralGain);

    this.leftOsc.start();
    this.rightOsc.start();

    this.setupMediaSession();
  }

  private setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'ZenBeats',
        artist: 'Deep Theta Session',
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
    if (this.silentAudio?.paused) {
      this.silentAudio.play().catch(() => {});
    }
    if (this.outputAudioElement?.paused) {
      this.outputAudioElement.play().catch(() => {});
    }
  }

  private ramp(param: AudioParam, value: number, immediate: boolean = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (immediate) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(value, now);
    } else {
      param.setTargetAtTime(value, now, this.TIME_CONSTANT);
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
      this.rightOsc.frequency.setTargetAtTime(this.binauralBaseFreq + freq, this.ctx.currentTime, 0.3);
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
      node.internalGain.gain.setTargetAtTime(0, now, 0.1);
    }
    if (node.lookaheadTimer) window.clearInterval(node.lookaheadTimer);
    
    setTimeout(() => {
      try { node.source?.stop(); } catch(e) {}
      try { node.lfo?.stop(); } catch(e) {}
      try { node.breezeSource?.stop(); } catch(e) {}
      this.natureNodes.delete(type);
    }, 500);
  }

  updateNoise(color: NoiseColor) {
    if (!this.ctx) return;
    
    if (this.colorNoiseGain) {
      this.ramp(this.colorNoiseGain.gain, 0);
      const oldNode = this.colorNoiseNode;
      setTimeout(() => { try { oldNode?.stop(); } catch(e) {} }, 500);
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

  stop() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(0.0001, now, 0.4);
    
    setTimeout(() => {
      this.mutePermanentOscillators();
      this.natureNodes.forEach((node, type) => this.fadeOutNatureNode(node, type));
      if (this.colorNoiseNode) {
        try { this.colorNoiseNode.stop(); } catch(e) {}
        this.colorNoiseNode = null;
      }
      if (this.outputAudioElement) this.outputAudioElement.pause();
      if (this.silentAudio) this.silentAudio.pause();
    }, 600);
    
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }

  private mutePermanentOscillators() {
    if (this.leftOscGain) this.ramp(this.leftOscGain.gain, 0);
    if (this.rightOscGain) this.ramp(this.rightOscGain.gain, 0);
  }

  async start(natures: NatureSound[], noise: NoiseColor, freq: number, targetMasterVolume: number) {
    await this.resumeIfSuspended();
    if (!this.ctx) this.init();
    
    // Gate oscillators open
    if (this.leftOscGain) this.ramp(this.leftOscGain.gain, 1.0);
    if (this.rightOscGain) this.ramp(this.rightOscGain.gain, 1.0);
    
    this.updateFrequency(freq);
    this.updateNatures(natures);
    this.updateNoise(noise);
    
    this.ramp(this.masterGain!, targetMasterVolume, false);
    
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  }

  private createNoiseBuffer(type: 'white' | 'pink' | 'brown' | 'green' = 'white') {
    const duration = 15; 
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

    const fade = Math.floor(0.5 * this.ctx!.sampleRate);
    for (let i = 0; i < fade; i++) {
      const alpha = i / fade;
      output[i] = output[i] * alpha + output[bufferSize - fade + i] * (1 - alpha);
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
        // Fix for TypeScript ambiguity in chained connect calls with nullable nodes
        lfo.connect(lfoGain!);
        lfoGain.connect(filter.frequency);
        lfo.start(now);
        break;
      case NatureSound.SEA: 
        filter.type = 'lowpass'; filter.frequency.value = 550; mod.gain.value = 0.3;
        lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.08; 
        lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.2;
        // Fix for TypeScript ambiguity in chained connect calls with nullable nodes
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
      
      const scheduleWindow = 5; 
      while (nextBirdTime < this.ctx.currentTime + scheduleWindow) {
        const startTime = nextBirdTime;
        const count = 2 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < count; i++) {
          const chirpStart = startTime + (i * (0.2 + Math.random() * 0.3));
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          const freq = 3200 + Math.random() * 1000;
          osc.frequency.setValueAtTime(freq, chirpStart);
          osc.frequency.exponentialRampToValueAtTime(freq + 1000, chirpStart + 0.12);
          
          g.gain.setValueAtTime(0, chirpStart);
          g.gain.linearRampToValueAtTime(0.03, chirpStart + 0.03);
          g.gain.linearRampToValueAtTime(0, chirpStart + 0.4);
          
          osc.connect(g).connect(internalGain);
          osc.start(chirpStart);
          osc.stop(chirpStart + 0.5);
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
