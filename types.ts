
export enum NatureSound {
  NONE = 'None',
  SEA = 'Sea',
  WIND = 'Wind',
  RAIN = 'Rain',
  FOREST = 'Forest',
  NIGHT = 'Night',
  BIRDS = 'Birds'
}

export enum NoiseColor {
  NONE = 'None',
  WHITE = 'White',
  PINK = 'Pink',
  BROWN = 'Brown',
  GREEN = 'Green'
}

export interface AudioSettings {
  binauralVolume: number; 
  natureVolume: number;
  noiseVolume: number;
  masterVolume: number; 
  frequency: number; 
  selectedNatures: NatureSound[]; 
  selectedNoise: NoiseColor;
  duration: number; // in minutes
}

export interface AudioState {
  isPlaying: boolean;
  timeLeft: number; // in seconds
}
