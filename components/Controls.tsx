import React from 'react';
import { NatureSound, AudioSettings, NoiseColor } from '../types';

interface ControlsProps {
  settings: AudioSettings;
  updateSettings: (newSettings: Partial<AudioSettings>) => void;
  disabled: boolean;
}

const Controls: React.FC<ControlsProps> = ({ settings, updateSettings, disabled }) => {
  const toggleNature = (sound: NatureSound) => {
    if (sound === NatureSound.NONE) {
      updateSettings({ selectedNatures: [] });
      return;
    }
    let newNatures = [...settings.selectedNatures];
    if (newNatures.includes(sound)) {
      newNatures = newNatures.filter(n => n !== sound);
    } else {
      if (newNatures.length >= 2) newNatures.shift();
      newNatures.push(sound);
    }
    updateSettings({ selectedNatures: newNatures });
  };

  // Alphabetical brainwave states with Hz labels
  const brainwaveStates = [
    { label: 'Alpha', freq: 10, hz: '10Hz' },
    { label: 'Beta', freq: 15, hz: '15Hz' },
    { label: 'Delta', freq: 2, hz: '2Hz' },
    { label: 'Theta', freq: 5, hz: '5Hz' }
  ];

  const natureMeta: Record<NatureSound, { img: string }> = {
    [NatureSound.SEA]: { img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400' }, 
    [NatureSound.RAIN]: { img: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&q=80&w=400' },
    [NatureSound.THUNDER]: { img: 'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?auto=format&fit=crop&q=80&w=400' },
    [NatureSound.FOREST]: { img: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=400' },
    [NatureSound.WIND]: { img: 'https://images.unsplash.com/photo-1530906358829-e84b2769270f?auto=format&fit=crop&q=80&w=400' }, 
    [NatureSound.NIGHT]: { img: 'https://images.unsplash.com/photo-1501418611786-e29f9929fe03?auto=format&fit=crop&q=80&w=400' },
    [NatureSound.NONE]: { img: '' }
  };

  return (
    <div className="flex flex-col space-y-[25px]">
      
      {/* Brainwave Selection */}
      <section className="flex flex-col space-y-4">
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] px-1">Target State</h3>
        <div className="grid grid-cols-4 bg-slate-200/60 p-1 rounded-2xl gap-1 w-full border border-slate-200">
          {brainwaveStates.map((state) => (
            <button
              key={state.label}
              onClick={() => updateSettings({ frequency: state.freq })}
              className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all ${
                settings.frequency === state.freq ? 'bg-white text-sky-700 shadow-md scale-[1.02]' : 'text-slate-600'
              } active:scale-95 uppercase`}
            >
              <span className="text-[10px] font-black tracking-widest">{state.label}</span>
              <span className="text-[8px] font-bold opacity-60 tracking-tighter mt-0.5">{state.hz}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Soundscapes Selection */}
      <section className="flex flex-col space-y-4">
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] px-1">Soundscapes</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.values(NatureSound).filter(s => s !== NatureSound.NONE).map((sound) => {
            const isActive = settings.selectedNatures.includes(sound);
            return (
              <button
                key={sound}
                onClick={() => toggleNature(sound)}
                className={`relative h-28 rounded-2xl overflow-hidden transition-all border-2 flex items-center justify-center ${
                  isActive ? 'border-sky-500 shadow-xl ring-4 ring-sky-500/10' : 'border-white shadow-sm'
                } active:scale-95`}
              >
                <div 
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${natureMeta[sound].img})` }}
                />
                <div className={`absolute inset-0 transition-opacity ${isActive ? 'bg-black/20' : 'bg-black/50'}`} />
                <span className={`relative text-[10px] font-black uppercase tracking-widest text-center text-white drop-shadow-md z-10 ${isActive ? 'scale-110' : 'opacity-80'}`}>
                  {sound}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Noise Texture Selection */}
      <section className="flex flex-col space-y-4">
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] px-1">Noise Texture</h3>
        <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-200/40 rounded-2xl border border-slate-200">
          {Object.values(NoiseColor).map((color) => (
            <button
              key={color}
              onClick={() => updateSettings({ selectedNoise: color })}
              className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                settings.selectedNoise === color ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {color === NoiseColor.NONE ? 'Off' : color}
            </button>
          ))}
        </div>
      </section>

      {/* Mixer Dashboard */}
      <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-2xl space-y-[25px]">
        <div className="flex flex-col items-center space-y-1">
          <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Mixer Dashboard</h3>
          <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Binaural & Ambient Balance</p>
        </div>
        
        <div className="grid grid-cols-1 gap-y-[25px]">
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Binaural Pulse</span>
              <span className="text-[11px] font-black text-sky-700">{Math.round(settings.binauralVolume * 100)}%</span>
            </div>
            <input
              type="range" min="0" max="0.5" step="0.01" value={settings.binauralVolume}
              onChange={(e) => updateSettings({ binauralVolume: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Ambient (Nature)</span>
              <span className="text-[11px] font-black text-sky-700">{Math.round(settings.natureVolume * 100)}%</span>
            </div>
            <input
              type="range" min="0" max="0.5" step="0.01" value={settings.natureVolume}
              onChange={(e) => updateSettings({ natureVolume: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-x-8 pt-6 border-t border-slate-50">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Static Noise</span>
                <span className="text-[10px] font-black text-sky-700">{Math.round(settings.noiseVolume * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01" value={settings.noiseVolume}
                onChange={(e) => updateSettings({ noiseVolume: parseFloat(e.target.value) })}
                className="w-full h-1"
              />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Master</span>
                <span className="text-[10px] font-black text-sky-700">{Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01" value={settings.masterVolume}
                onChange={(e) => updateSettings({ masterVolume: parseFloat(e.target.value) })}
                className="w-full h-1"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Controls;