import { describe, it, expect } from 'vitest'
import { packRasterLines } from './image'

function makeMono(width: number, height: number, pattern: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = pattern(x, y)
      const i = (y * width + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  // Return a minimal ImageData-like object to avoid requiring DOM ImageData constructor
  return { data, width, height } as any
}

describe('packRasterLines', () => {
  it('packs MSB-first and flips horizontally with margin swap', () => {
    // 8 px wide, 1px tall, black pixel at visual left (x=0)
    const mono = makeMono(8, 1, (x) => (x === 0 ? 0 : 255))
    const left = 2, right = 6
    const lines = packRasterLines(mono, 8, left, right, /*flipMargins*/ true)
    const line = lines[0]
    // With horizontal flip, srcX=0 maps to px=7. With margin flip, effectiveLeft=right=6.
    // bit index = 6 + 7 = 13 -> byte 1, bit position 7 - (13 & 7) = 2
    const expectedBitIndex = (right) + 7
    const expectedByteIdx = expectedBitIndex >> 3
    const expectedBit = 1 << (7 - (expectedBitIndex & 7))
    expect(line[expectedByteIdx]).toBe(expectedBit)
    // All other bytes should be zero
    for (let i = 0; i < line.length; i++) {
      if (i === expectedByteIdx) continue
      expect(line[i]).toBe(0)
    }
  })
})
