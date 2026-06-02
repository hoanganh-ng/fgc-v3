type DecimalDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type Hour = `0${DecimalDigit}` | `1${DecimalDigit}` | `2${'0' | '1' | '2' | '3'}`;
type Minute = `${'0' | '1' | '2' | '3' | '4' | '5'}${DecimalDigit}`;

export type TimeOfDay = `${Hour}:${Minute}`;
