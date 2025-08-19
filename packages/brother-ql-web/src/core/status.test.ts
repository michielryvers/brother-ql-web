import { describe, it, expect } from 'vitest'
import { parseStatus, MEDIA_TYPE } from './status'

// Minimal synthetic status frame helper
function frame(parts: Partial<Record<string, number>> = {}) {
  const f = new Uint8Array(32)
  f[0] = 0x80; f[1] = 0x20; f[2] = 0x42; // header 'B'
  f[4] = 0x35; // model QL700
  f[8] = parts.err1 ?? 0
  f[9] = parts.err2 ?? 0
  f[10] = parts.mediaWidth ?? 62
  f[11] = parts.mediaType ?? MEDIA_TYPE.Continuous
  f[17] = parts.mediaLen ?? 0
  f[18] = parts.statusType ?? 0
  f[19] = parts.phaseType ?? 0
  f[20] = 0; f[21] = 0;
  f[22] = 0
  return f
}

describe('parseStatus', () => {
  it('maps continuous 62mm pins', () => {
    const st = parseStatus(frame({ mediaWidth: 62, mediaType: MEDIA_TYPE.Continuous }))
    expect(st.printableDots).toBe(696)
    expect(st.leftMargin).toBe(12)
    expect(st.rightMargin).toBe(12)
  })

  it('maps 12mm continuous pins', () => {
    const st = parseStatus(frame({ mediaWidth: 12, mediaType: MEDIA_TYPE.Continuous }))
    expect(st.printableDots).toBeGreaterThan(0)
    expect(st.leftMargin).toBeGreaterThanOrEqual(0)
  })
})
