import { describe, it, expect } from 'vitest'
import { printInformation, rasterData } from './commands'
import { MEDIA_TYPE, type PrinterStatus } from './status'

const fakeStatus: PrinterStatus = {
  headerOk: true,
  model: 0x35 as any,
  mediaWidthMm: 62,
  mediaType: MEDIA_TYPE.Continuous,
  mediaLengthMm: 0,
  error1: 0 as any,
  error2: 0 as any,
  statusType: 0 as any,
  phaseType: 0 as any,
  phaseNumber: 0,
  notification: 0,
  leftMargin: 12,
  printableDots: 696,
  rightMargin: 12,
}

describe('commands', () => {
  it('builds printInformation with correct fields', () => {
    const cmd = printInformation(fakeStatus, 123)
    expect(cmd[0]).toBe(0x1b)
    expect(cmd[1]).toBe(0x69)
    expect(cmd[2]).toBe(0x7a)
    // n1 has printer recovery + kind + width
    expect(cmd[3] & 0x80).toBe(0x80)
    expect(cmd[3] & 0x02).toBe(0x02)
    expect(cmd[3] & 0x04).toBe(0x04)
    // n2..n4
    expect(cmd[4]).toBe(MEDIA_TYPE.Continuous)
    expect(cmd[5]).toBe(62)
    expect(cmd[6]).toBe(0)
    // line count n5..n8 LE
    const count = cmd[7] | (cmd[8] << 8) | (cmd[9] << 16) | (cmd[10] << 24)
    expect(count).toBe(123)
  })

  it('wraps rasterData with header and length', () => {
    const line = new Uint8Array(90)
    line[0] = 0xff
    const cmd = rasterData(line)
    expect(cmd.length).toBe(3 + 90)
    expect(cmd[0]).toBe(0x67)
    expect(cmd[2]).toBe(0x5a)
    expect(cmd[3]).toBe(0xff)
  })
})
