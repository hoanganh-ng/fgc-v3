import type { PersonaType } from '../types/persona-type.type';
import type { MacroDelayMs } from './macro-delay-ms.value-object';

export interface BehavioralPersona {
  personaType: PersonaType;
  scrollPattern: string;
  macroDelayMs: MacroDelayMs;
  upwardScrollChance: number;
}
