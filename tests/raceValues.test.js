import test from 'node:test'
import assert from 'node:assert/strict'
import { resultValue, csvValue } from '../src/lib/raceValues.js'
test('lap arrays and nested session values render without React object errors', () => {
  assert.equal(resultValue([1000,1200]),'1000, 1200')
  assert.equal(resultValue({laps:2}),'{"laps":2}')
  assert.equal(resultValue(null),'—')
})
test('CSV escapes quotes and prevents spreadsheet formulas', () => {
  assert.equal(csvValue('A"B'),'"A""B"')
  assert.equal(csvValue('=1+1'),'"\'=1+1"')
})
