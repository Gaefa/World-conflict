export type ArmyType = 'infantry' | 'armored' | 'naval' | 'airforce' | 'special_ops';
export type ArmyStatus = 'idle' | 'moving' | 'attacking' | 'defending' | 'retreating';

export interface Army {
  id: string;
  ownerCountry: string;       // country code
  sessionId: string;
  name: string;
  type: ArmyType;
  size: number;                // personnel/units
  morale: number;              // 0-100
  experience: number;          // 0-100
  latitude: number;
  longitude: number;
  targetLatitude: number | null;
  targetLongitude: number | null;
  status: ArmyStatus;
  createdAtTick: number;
}
