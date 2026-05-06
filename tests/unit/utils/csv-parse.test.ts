import { describe, it, expect } from 'vitest';
import { parseCsv } from '@/lib/utils/csv-parse';

describe('parseCsv', () => {
  it('parses a basic CSV with header', () => {
    const input = 'name,age\nAlice,30\nBob,25';
    const { headers, rows } = parseCsv(input);
    expect(headers).toEqual(['name', 'age']);
    expect(rows).toEqual([['Alice', '30'], ['Bob', '25']]);
  });

  it('lowercases headers', () => {
    const { headers } = parseCsv('Name,EMAIL\nAlice,a@b.com');
    expect(headers).toEqual(['name', 'email']);
  });

  it('handles quoted cells with commas', () => {
    const input = 'name,desc\n"Alice, the great","Hi, friend"';
    const { rows } = parseCsv(input);
    expect(rows[0]).toEqual(['Alice, the great', 'Hi, friend']);
  });

  it('handles escaped quotes inside quoted cell', () => {
    const input = 'q\n"She said ""hi"""';
    const { rows } = parseCsv(input);
    expect(rows[0]).toEqual(['She said "hi"']);
  });

  it('handles CRLF line endings', () => {
    const input = 'a,b\r\n1,2\r\n3,4';
    const { rows } = parseCsv(input);
    expect(rows).toEqual([['1', '2'], ['3', '4']]);
  });

  it('strips UTF-8 BOM', () => {
    const input = '﻿name\nAlice';
    const { headers } = parseCsv(input);
    expect(headers).toEqual(['name']);
  });

  it('autodetects semicolon separator', () => {
    const input = 'name;age\nAlice;30';
    const { headers, rows } = parseCsv(input);
    expect(headers).toEqual(['name', 'age']);
    expect(rows).toEqual([['Alice', '30']]);
  });

  it('filters fully empty rows', () => {
    const input = 'name\n\nAlice\n';
    const { rows } = parseCsv(input);
    expect(rows).toEqual([['Alice']]);
  });

  it('returns empty when input is empty', () => {
    const result = parseCsv('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('handles cells with newlines inside quotes', () => {
    const input = 'note\n"line1\nline2"';
    const { rows } = parseCsv(input);
    expect(rows[0]).toEqual(['line1\nline2']);
  });
});
