// src/core/time.test.js
import { describe, it, expect } from 'vitest';
import { timeToSec } from './time.js';

describe('timeToSec', () => {
  it('converte HH:MM:SS corretamente', () => {
    expect(timeToSec('01:30:00')).toBe(5400);
    expect(timeToSec('00:05:30')).toBe(330);
  });

  it('converte MM:SS corretamente', () => {
    expect(timeToSec('10:45')).toBe(645);
  });

  it('retorna 0 para entradas inválidas', () => {
    expect(timeToSec('')).toBe(0);
    expect(timeToSec(null)).toBe(0);
    expect(timeToSec('abc')).toBe(0);
  });
});