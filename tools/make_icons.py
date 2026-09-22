#!/usr/bin/env python3
"""Cut the app icon out of the Trevisane sheet.

    python3 tools/make_icons.py            # writes assets/ and public/icons/

The icon is the fante di spade — in Veneto, la vecia. It is card number 8 of
the Spade suit, which on the 11x4 grid that tools/pack_cards.py writes is
column 7, row 2. The top half of the card is the half with the face in it: the
bottom half is the same figure mirrored, the way Italian court cards are drawn.

Nothing here redraws anything. The crop is nearest-neighbour scaled, so every
output pixel is one source pixel repeated — the 1997 bitmap, larger. Smooth
scaling was tried and rejected: at icon sizes it turns the face to mush, and
CLAUDE.md is explicit that the card art is not to be redrawn. Interpolation
invents pixels, which is redrawing by another name.

Outputs, and who consumes them:

  assets/icon-only.png         1024  @capacitor/assets -> every Android density
  assets/icon-foreground.png   1024  the adaptive icon's foreground layer
  assets/icon-background.png   1024  the adaptive icon's background layer
  public/icons/icon-512.png     512  web app manifest
  public/icons/icon-192.png     192  web app manifest
  public/icons/apple-touch-icon.png  180
  public/icons/favicon-32.png    32  <link rel=icon>, and what stops the
                                     browser asking for /favicon.ico
  desktop/src-tauri/icons/32x32.png          32  Tauri bundle.icon
  desktop/src-tauri/icons/128x128.png       128  Tauri bundle.icon
  desktop/src-tauri/icons/128x128@2x.png    256  Tauri bundle.icon
  desktop/src-tauri/icons/icon.png          512  Tauri bundle.icon
  desktop/src-tauri/icons/icon.ico   16/32/48/256  the Windows resource

The .ico is a real multi-size icon (PNG frames, Vista+ ICO), not a single image
with a small header: Windows picks the size it needs from the frames.
"""
import os
import struct
import sys
import zlib

SHEET = "public/decks/trevisane.png"

# The card, on pack_cards.py's grid: columns 0..9 are card numbers 1..10, rows
# 0..3 are the suits in TSeme order (Denari, Coppe, Spade, Bastoni).
COL, ROW = 7, 2  # spade n.8 — la vecia

# The crop inside that cell, in card pixels, measured off the 60x125 cell:
# the face sits at y 13..30 and the torso runs to y 55, after which the
# mirrored bottom figure's head appears. Square, so no output has to stretch.
CROP_X, CROP_Y, CROP_W, CROP_H = 7, 4, 50, 50

# The felt, matching the table and the theme colour in ROADMAP.md's Iteration 1.
FELT = (13, 38, 32, 255)

# Android masks an adaptive icon down to a shape of its choosing and may
# animate it inside the frame, so the foreground layer must keep everything
# that matters inside the middle 66%. The rest is margin it is allowed to eat.
SAFE = 0.66


def read_png(path):
    """Return (width, height, rows of (r,g,b,a)) for an 8-bit RGB/RGBA PNG."""
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path}: not a PNG")

    pos, idat, ihdr = 8, bytearray(), None
    while pos < len(data):
        length = struct.unpack_from(">I", data, pos)[0]
        tag = data[pos + 4: pos + 8]
        payload = data[pos + 8: pos + 8 + length]
        if tag == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", payload)
        elif tag == b"IDAT":
            idat += payload
        elif tag == b"IEND":
            break
        pos += 12 + length

    width, height, depth, colour, _, _, interlace = ihdr
    if depth != 8 or interlace != 0 or colour not in (2, 6):
        raise ValueError(f"{path}: want 8-bit non-interlaced RGB or RGBA, got depth {depth} colour {colour}")
    channels = 4 if colour == 6 else 3

    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    rows, prev = [], bytearray(stride)
    pos = 0
    for _ in range(height):
        ftype = raw[pos]
        line = bytearray(raw[pos + 1: pos + 1 + stride])
        pos += 1 + stride
        for i in range(stride):
            a = line[i - channels] if i >= channels else 0
            b = prev[i]
            c = prev[i - channels] if i >= channels else 0
            if ftype == 1:
                line[i] = (line[i] + a) & 0xFF
            elif ftype == 2:
                line[i] = (line[i] + b) & 0xFF
            elif ftype == 3:
                line[i] = (line[i] + ((a + b) >> 1)) & 0xFF
            elif ftype == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pred) & 0xFF
        rows.append([
            tuple(line[x * channels: x * channels + channels]) + ((255,) if channels == 3 else ())
            for x in range(width)
        ])
        prev = line
    return width, height, rows


def png_bytes(width, height, pixels):
    """An RGBA PNG. Filter 0 throughout: these are nearest-neighbour upscales,
    so every row is long runs of identical bytes and zlib already has
    everything it needs. pack_cards.py's adaptive search costs minutes at
    1024x1024 and saves nothing worth having on this kind of image."""

    def chunk(tag, payload):
        body = tag + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for px in pixels[y]:
            raw += bytes(px)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def write_png(path, width, height, pixels):
    png = png_bytes(width, height, pixels)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(png)
    return len(png)


def write_ico(path, images):
    """A multi-size ICO from (size, png bytes) frames. PNG-in-ICO is accepted
    since Vista; Windows selects the frame it wants instead of scaling one."""
    header = struct.pack("<HHH", 0, 1, len(images))
    entries, offset = bytearray(), 6 + 16 * len(images)
    for size, data in images:
        dim = 0 if size >= 256 else size      # 0 means 256 in the ICO header
        entries += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    blob = header + bytes(entries) + b"".join(data for _, data in images)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(blob)
    return len(blob)


def scale(tile, size):
    """Nearest-neighbour. See the module docstring for why not something better."""
    src = len(tile)
    return [[tile[y * src // size][x * src // size] for x in range(size)] for y in range(size)]


def over(dst, src, x0, y0):
    """Source-over composite, which only has to handle the fully transparent
    padding the sheet puts around each card — no partial alpha in this art."""
    for y, row in enumerate(src):
        for x, px in enumerate(row):
            if px[3]:
                dst[y0 + y][x0 + x] = px


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    width, height, rows = read_png(SHEET)
    cell_w, cell_h = width // 11, height // 4
    ox, oy = COL * cell_w + CROP_X, ROW * cell_h + CROP_Y
    if CROP_X + CROP_W > cell_w or CROP_Y + CROP_H > cell_h:
        sys.exit(f"crop {CROP_W}x{CROP_H} at {CROP_X},{CROP_Y} does not fit a {cell_w}x{cell_h} cell")
    tile = [row[ox: ox + CROP_W] for row in rows[oy: oy + CROP_H]]

    # The card is opaque where it matters, but the sheet pads cells with
    # transparency; anything that leaks through should read as card, not hole.
    paper = (242, 239, 230, 255)
    tile = [[px if px[3] else paper for px in row] for row in tile]

    written = []

    def emit(path, size, pixels):
        written.append((path, size, write_png(path, size, size, pixels)))

    for path, size in [("assets/icon-only.png", 1024),
                       ("public/icons/icon-512.png", 512),
                       ("public/icons/icon-192.png", 192),
                       ("public/icons/apple-touch-icon.png", 180),
                       ("public/icons/favicon-32.png", 32)]:
        emit(path, size, scale(tile, size))

    # The adaptive icon, as two layers Android composites and masks itself.
    n = 1024
    emit("assets/icon-background.png", n, [[FELT] * n for _ in range(n)])
    inner = int(n * SAFE) // 2 * 2
    fg = [[(0, 0, 0, 0)] * n for _ in range(n)]
    over(fg, scale(tile, inner), (n - inner) // 2, (n - inner) // 2)
    emit("assets/icon-foreground.png", n, fg)

    # Desktop icons, referenced by desktop/src-tauri/tauri.conf.json's bundle.icon.
    desk = "desktop/src-tauri/icons"
    for name, size in [("32x32.png", 32), ("128x128.png", 128),
                       ("128x128@2x.png", 256), ("icon.png", 512)]:
        emit(f"{desk}/{name}", size, scale(tile, size))
    ico = write_ico(f"{desk}/icon.ico",
                    [(s, png_bytes(s, s, scale(tile, s))) for s in (16, 32, 48, 256)])
    written.append((f"{desk}/icon.ico", 256, ico))

    for path, size, nbytes in written:
        print(f"{path:38} {size:>4}px  {nbytes / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
