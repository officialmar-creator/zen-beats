
import { NatureSound, NoiseColor } from '../types';

class AudioService {
  private ctx: AudioContext | null = null;
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
    rainSource?: AudioBufferSourceNode; 
  }> = new Map();
  
  private colorNoiseNode: AudioBufferSourceNode | null = null;
  private readonly FADE_DURATION = 1.5;

  private mediaStreamElement: HTMLAudioElement | null = null;
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
  private heartbeatSource: OscillatorNode | null = null;

  constructor() {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        this.resumeIfSuspended().catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
  }

  init() {
    if (this.ctx) return;
    
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'playback',
      sampleRate: 44100 
    });
    
    this.mediaStreamDestination = this.ctx.createMediaStreamDestination();
    this.mediaStreamElement = new Audio();
    this.mediaStreamElement.srcObject = this.mediaStreamDestination.stream;
    this.mediaStreamElement.setAttribute('playsinline', 'true');
    this.mediaStreamElement.style.display = 'none';
    this.mediaStreamElement.volume = 1.0; 
    document.body.appendChild(this.mediaStreamElement);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.ctx.destination);
    
    this.masterGain.connect(this.mediaStreamDestination);
    
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
        title: 'ZenBeats Session',
        artist: '5Hz Deep Theta',
        artwork: [{ src: 'https://images.unsplash.com/photo-1590273466070-40c466b4432d?w=512&h=512&fit=crop', sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', () => this.resumeIfSuspended());
      navigator.mediaSession.setActionHandler('pause', () => this.stop());
    }
  }

  async resumeIfSuspended() {
    if (!this.ctx) this.init();
    if (this.ctx!.state === 'suspended') await this.ctx!.resume();
    if (this.mediaStreamElement && this.mediaStreamElement.paused) {
      await this.mediaStreamElement.play().catch(() => {});
    }
  }

  setBinauralVolume(val: number) {
    if (this.binauralGain && this.ctx) {
      const target = Math.max(0.0001, val * 0.7);
      this.binauralGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    }
  }

  setMasterVolume(val: number) {
    if (this.masterGain && this.ctx) {
      const target = Math.max(0.0001, Math.min(val, 0.95));
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    }
  }

  setNatureVolume(val: number) {
    if (this.natureGain && this.ctx) {
      const target = Math.max(0.0001, val * 0.9);
      this.natureGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    }
  }

  setNoiseVolume(val: number) {
    if (this.noiseGain && this.ctx) {
      const target = Math.max(0.0001, val * 0.4);
      this.noiseGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    }
  }

  updateFrequency(freq: number) {
    if (this.rightOsc && this.ctx) {
      this.rightOsc.frequency.setTargetAtTime(this.binauralBaseFreq + freq, this.ctx.currentTime, 0.2);
    }
  }

  updateNatures(selectedNatures: NatureSound[]) {
    if (!this.ctx) return;
    this.natureNodes.forEach((node, type) => {
      if (!selectedNatures.includes(type)) {
        this.stopNatureNode(node);
        this.natureNodes.delete(type);
      }
    });
    selectedNatures.forEach(n => {
      if (!this.natureNodes.has(n)) this.startNature(n);
    });
  }

  private stopNatureNode(node: any) {
    try { node.source?.stop(); } catch(e) {}
    try { node.breezeSource?.stop(); } catch(e) {}
    try { node.rainSource?.stop(); } catch(e) {}
    try { node.lfo?.stop(); } catch(e) {}
    if (node.timer) window.clearTimeout(node.timer);
  }

  updateNoise(color: NoiseColor) {
    if (!this.ctx) return;
    if (this.colorNoiseNode) {
      try { this.colorNoiseNode.stop(); } catch(e) {}
      this.colorNoiseNode = null;
    }
    if (color !== NoiseColor.NONE) {
      this.colorNoiseNode = this.ctx.createBufferSource();
      this.colorNoiseNode.buffer = this.createNoiseBuffer(color.toLowerCase() as any);
      this.colorNoiseNode.loop = true;
      this.colorNoiseNode.connect(this.noiseGain!);
      this.colorNoiseNode.start();
    }
  }

  stop() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    
    setTimeout(() => {
      this.stopNodesImmediately();
      if (this.mediaStreamElement) this.mediaStreamElement.pause();
    }, 1300);
    
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }

  private stopNodesImmediately() {
    try { this.leftOsc?.stop(); } catch(e) {}
    try { this.rightOsc?.stop(); } catch(e) {}
    try { this.heartbeatSource?.stop(); } catch(e) {}
    this.leftOsc = null;
    this.rightOsc = null;
    this.heartbeatSource = null;
    this.natureNodes.forEach(n => this.stopNatureNode(n));
    this.natureNodes.clear();
    if (this.colorNoiseNode) {
      try { this.colorNoiseNode.stop(); } catch(e) {}
      this.colorNoiseNode = null;
    }
  }

  async start(natures: NatureSound[], noise: NoiseColor, freq: number, targetMasterVolume: number) {
    await this.resumeIfSuspended();
    this.stopNodesImmediately();
    
    const now = this.ctx!.currentTime;
    this.masterGain!.gain.cancelScheduledValues(now);
    this.masterGain!.gain.setValueAtTime(0.0001, now);

    this.heartbeatSource = this.ctx!.createOscillator();
    this.heartbeatSource.frequency.value = 440; 
    const silentGain = this.ctx!.createGain();
    silentGain.gain.value = 0.0001; 
    this.heartbeatSource.connect(silentGain).connect(this.mediaStreamDestination!);
    this.heartbeatSource.start(now);

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
    
    this.masterGain!.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetMasterVolume), now + this.FADE_DURATION);
    
    if (this.mediaStreamElement) {
      this.mediaStreamElement.play().catch(e => console.error("MediaStream play error", e));
    }
    
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  }

  private createNoiseBuffer(type: 'white' | 'pink' | 'brown' | 'green' = 'white') {
    const duration = 10; 
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

    const crossfadeSamples = Math.floor(0.2 * this.ctx!.sampleRate);
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
    source.connect(filter).connect(mod).connect(this.natureGain!);
    
    const now = this.ctx.currentTime;
    let lfo: OscillatorNode | undefined;
    let lfoGain: GainNode | undefined;

    switch (type) {
      case NatureSound.RAIN: 
        filter.type = 'lowpass'; filter.frequency.value = 1400; mod.gain.value = 0.3; 
        break;
      case NatureSound.WIND: 
        filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 1.0; mod.gain.value = 0.3;
        lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.15;
        lfoGain = this.ctx.createGain(); lfoGain.gain.value = 400;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start(now);
        break;
      case NatureSound.SEA: 
        filter.type = 'lowpass'; filter.frequency.value = 600; mod.gain.value = 0.3;
        lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.12; 
        lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.25;
        lfo.connect(lfoGain).connect(mod.gain);
        lfo.start(now);
        break;
      case NatureSound.NIGHT: 
        filter.type = 'highpass'; filter.frequency.value = 5000; mod.gain.value = 0.01;
        break;
      case NatureSound.FOREST: 
        filter.type = 'highpass'; filter.frequency.value = 2500; mod.gain.value = 0.12; 
        break;
    }
    source.start(now);
    this.natureNodes.set(type, { source, filter, mod, lfo, lfoGain });
  }

  private startBirdsSoundscape() {
    if (!this.ctx) return;
    
    const breezeSource = this.ctx.createBufferSource();
    breezeSource.buffer = this.createNoiseBuffer('pink');
    breezeSource.loop = true;
    const breezeFilter = this.ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.value = 850;
    breezeFilter.Q.value = 0.4;
    const breezeGain = this.ctx.createGain();
    breezeGain.gain.value = 0.25; 
    breezeSource.connect(breezeFilter).connect(breezeGain).connect(this.natureGain!);
    breezeSource.start();

    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = this.createNoiseBuffer('white');
    rainSource.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 1300;
    const rainGain = this.ctx.createGain();
    rainGain.gain.value = 0.12; 
    rainSource.connect(rainFilter).connect(rainGain).connect(this.natureGain!);
    rainSource.start();

    const chirp = () => {
      if (!this.natureNodes.has(NatureSound.BIRDS)) return;
      
      const now = this.ctx!.currentTime;
      const count = 2 + Math.floor(Math.random() * 4); 
      
      for(let i=0; i<count; i++) {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        const startTime = now + (i * (0.08 + Math.random() * 0.15));
        
        osc.type = 'sine';
        const variation = Math.random();
        let baseFreq = 2500;
        let sweep = 1000;
        
        if (variation > 0.7) { baseFreq = 3800; sweep = 1500; }
        else if (variation < 0.3) { baseFreq = 1400; sweep = 600; }

        osc.frequency.setValueAtTime(baseFreq + Math.random() * 500, startTime);
        const direction = Math.random() > 0.5 ? 1 : -1;
        osc.frequency.exponentialRampToValueAtTime(baseFreq + (sweep * direction) + Math.random() * 500, startTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(baseFreq + (Math.random() * 300), startTime + 0.2);
        
        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.04, startTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2 + Math.random() * 0.3);
        
        osc.connect(g).connect(this.natureGain!);
        osc.start(startTime);
        osc.stop(startTime + 0.6);
      }
      
      const nextChirp = 100 + Math.random() * 1500; 
      const timer = window.setTimeout(chirp, nextChirp);
      this.natureNodes.set(NatureSound.BIRDS, { timer, breezeSource, rainSource });
    };
    
    this.natureNodes.set(NatureSound.BIRDS, { timer: window.setTimeout(chirp, 100), breezeSource, rainSource });
  }
}

export const audioService = new AudioService();
