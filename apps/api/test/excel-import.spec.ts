import { describe, expect, it } from 'vitest';
import { classifyHeaders } from '../src/excel/excel-import.service.js';

describe('classifyHeaders', () => {
  it('accepts the C Dilbeck Stores layout', () => {
    const layout = classifyHeaders([
      'Store #',
      'Store Name',
      'State',
      'Address',
      'Latitude',
      'Longitude',
      'Regional',
      'Outside Paint Task',
      'Gas Lid Task',
      'Handicap',
      'Canopy',
      'Crash',
      'Dog Bones',
      'Gas Lids',
      'Lines',
    ]);
    expect(layout.errors).toEqual([]);
    expect(layout.taskColumns).toEqual(['Outside_Paint_Task', 'Gas_Lid_Task']);
    expect(layout.countColumns).toEqual([
      'Handicap',
      'Canopy',
      'Crash',
      'Dog_Bones',
      'Gas_Lids',
      'Lines',
    ]);
    expect(layout.fixedColumnIndex.latitude).toBe(4);
    expect(layout.fixedColumnIndex.longitude).toBe(5);
    expect(layout.fixedColumnIndex.regional).toBe(6);
  });

  it('accepts the Week 1 Lawn 2026 layout', () => {
    const layout = classifyHeaders([
      'Store',
      'Store Name',
      'State',
      'Address',
      'Zip',
      'Latitude',
      'Longitude',
      'Lawn Task',
      'Notes',
    ]);
    expect(layout.errors).toEqual([]);
    expect(layout.taskColumns).toEqual(['Lawn_Task']);
    expect(layout.countColumns).toEqual([]);
    expect(layout.fixedColumnIndex.zip).toBe(4);
    expect(layout.fixedColumnIndex.latitude).toBe(5);
    expect(layout.fixedColumnIndex.longitude).toBe(6);
    expect(layout.fixedColumnIndex.notes).toBe(8);
  });

  it('accepts "Name" as column B (real client Caseys Test 2 layout)', () => {
    const layout = classifyHeaders([
      'Store',
      'Name', // ← real client files use this, not "Store Name"
      'State',
      'Address',
      'Zip',
      'Latitude',
      'Longitude',
      'Type',
      '', // blank column from legacy export
      'Manager',
      'Outside Paint Task',
      'Gas Lid Task',
      'Handicap',
      'Canopy Poles',
      'Crash Bars',
      'Dog Bones',
      'Gas Lids',
      'Lines',
    ]);
    expect(layout.errors).toEqual([]);
    expect(layout.taskColumns).toEqual(['Outside_Paint_Task', 'Gas_Lid_Task']);
    expect(layout.countColumns).toEqual([
      'Handicap',
      'Canopy_Poles',
      'Crash_Bars',
      'Dog_Bones',
      'Gas_Lids',
      'Lines',
    ]);
  });

  it('accepts "Store ID" + "Name" (real client Week 1 2026 layout)', () => {
    const layout = classifyHeaders([
      'Store ID',
      'Name',
      'State',
      'Address',
      'Zip',
      'Latitude',
      'Longitude',
      'Handicap Task',
      'Notes',
      'Lines',
    ]);
    expect(layout.errors).toEqual([]);
    expect(layout.taskColumns).toEqual(['Handicap_Task']);
    expect(layout.countColumns).toEqual(['Lines']);
    expect(layout.fixedColumnIndex.notes).toBe(8);
  });

  it('rejects missing latitude', () => {
    const layout = classifyHeaders(['Store', 'Store Name', 'State', 'Longitude']);
    expect(layout.errors).toContain('Latitude column is required');
  });

  it('rejects wrong column A', () => {
    const layout = classifyHeaders(['Storey', 'Store Name', 'Latitude', 'Longitude']);
    expect(layout.errors[0]).toMatch(/Column A/);
  });

  it('skips blank header columns (legacy empty-string-key bug)', () => {
    const layout = classifyHeaders([
      'Store',
      'Store Name',
      'State',
      '',
      'Latitude',
      'Longitude',
      'Notes',
    ]);
    expect(layout.errors).toEqual([]);
    expect(layout.countColumns).toEqual([]);
    expect(layout.fixedColumnIndex.notes).toBe(6);
  });
});
