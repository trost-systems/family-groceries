#!/usr/bin/env python3
"""Compares two same-size PNG screenshots (8-bit RGB or RGBA, no interlace) pixel by pixel.

Usage: pixel-diff.py a.png b.png
Prints the share of pixels that differ in any colour channel, how many differ by more than 32
of 255, and the largest channel difference. Used for the attempt 5 screenshots in
docs/screenshots/107 (Impeller vs Skia).
"""
import struct
import sys
import zlib


def read_png(path):
    data = open(path, 'rb').read()
    i, idat = 8, b''
    while i < len(data):
        n = struct.unpack('>I', data[i:i + 4])[0]
        kind, chunk = data[i + 4:i + 8], data[i + 8:i + 8 + n]
        if kind == b'IHDR':
            width, height, depth, colour = struct.unpack('>IIBB', chunk[:10])
            assert depth == 8 and colour in (2, 6), f'{path}: needs 8-bit RGB or RGBA'
        if kind == b'IDAT':
            idat += chunk
        i += 12 + n
    raw, bpp = zlib.decompress(idat), 4 if colour == 6 else 3
    stride, rows, prev, p = width * bpp, [], bytearray(width * bpp), 0
    for _ in range(height):
        kind, line = raw[p], bytearray(raw[p + 1:p + 1 + stride])
        p += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if kind == 1:
                line[x] = (line[x] + a) & 255
            elif kind == 2:
                line[x] = (line[x] + b) & 255
            elif kind == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif kind == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(bytes(line))
        prev = line
    return width, height, bpp, rows


def main(a, b):
    w1, h1, b1, r1 = read_png(a)
    w2, h2, b2, r2 = read_png(b)
    if (w1, h1) != (w2, h2):
        sys.exit(f'sizes differ: {w1}x{h1} vs {w2}x{h2}')
    differing = large = largest = 0
    for y in range(h1):
        for x in range(w1):
            d = max(abs(r1[y][x * b1 + k] - r2[y][x * b2 + k]) for k in range(3))
            differing += d > 0
            large += d > 32
            largest = max(largest, d)
    print(f'{differing / (w1 * h1) * 100:.2f}% of {w1}x{h1} pixels differ, {large} by more than 32, max {largest}')


if __name__ == '__main__':
    main(*sys.argv[1:3])
