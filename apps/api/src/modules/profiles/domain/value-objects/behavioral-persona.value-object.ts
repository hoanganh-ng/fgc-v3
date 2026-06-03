import type { PersonaType } from '../types/persona-type.type.js';
import type { MacroDelayMs } from './macro-delay-ms.value-object.js';

export interface BehavioralPersona {
  personaType: PersonaType;
  scrollPattern: string;
  macroDelayMs: MacroDelayMs;
  upwardScrollChance: number;
}
