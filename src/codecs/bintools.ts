// SPDX-FileCopyrightText: 2013 Chris Dickinson <chris@neversaw.us>
// SPDX-FileCopyrightText: 2014 Dominic Tarr
// SPDX-FileCopyrightText: 2022 Anders Rune Jensen <arj03@protonmail.ch>
// SPDX-License-Identifier: AGPL-3.0-or-later AND MIT

// this is a combination of the npm packages `signed-varint` and `varint` to avoid dependency hell

const MSB = 0x80;
const REST = 0x7f;
const MATH_POW_4 = Math.pow(2, 4 * 7);
const MATH_POW_5 = Math.pow(2, 5 * 7);
const MATH_POW_6 = Math.pow(2, 6 * 7);
const MATH_POW_7 = Math.pow(2, 7 * 7);
const MSBALL = ~REST;
const INT = Math.pow(2, 31);
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export function readUnsigned(buf: Uint8Array, offset: number = 0): { num: number; bytes: number; offset: number } {
    let bytes = 0;

    let byte = buf[offset];
    let num = 0;

    num += byte & REST;
    if (byte < MSB) {
        bytes = 1;
        return { num, bytes, offset: offset + bytes };
    }

    byte = buf[offset + 1];
    num += (byte & REST) << 7;
    if (byte < MSB) {
        bytes = 2;
        return { num, bytes, offset: offset + bytes };
    }

    byte = buf[offset + 2];
    num += (byte & REST) << 14;
    if (byte < MSB) {
        bytes = 3;
        return { num, bytes, offset: offset + bytes };
    }

    byte = buf[offset + 3];
    num += (byte & REST) << 21;
    if (byte < MSB) {
        bytes = 4;
        return { num, bytes, offset: offset + bytes };
    }

    byte = buf[offset + 4];
    num += (byte & REST) * MATH_POW_4;
    if (byte < MSB) {
        bytes = 5;
        return { num, bytes, offset: offset + bytes };
    }

    byte = buf[offset + 5];
    num += (byte & REST) * MATH_POW_5;
    if (byte < MSB) {
        bytes = 6;
        return { num, bytes, offset: offset + bytes };
    }

    byte = buf[offset + 6];
    num += (byte & REST) * MATH_POW_6;
    if (byte < MSB) {
        bytes = 7;
        return { num, bytes, offset: offset + bytes };
    }

    byte = buf[offset + 7];
    num += (byte & REST) * MATH_POW_7;
    if (byte < MSB) {
        bytes = 8;
        return { num, bytes, offset: offset + bytes };
    }

    throw new RangeError("Could not decode varint");
}

export function readSigned(
    buf: Uint8Array | Uint8Array,
    offset: number = 0,
): { num: number; bytes: number; offset: number } {
    const result = readUnsigned(buf, offset);
    const num = result.num;
    result.num = num & 1 ? (num + 1) / -2 : num / 2;
    return result;
}

export function writeUnsigned(num: number, buf: Uint8Array, offset: number = 0): { bytes: number; offset: number } {
    if (Number.MAX_SAFE_INTEGER && num > Number.MAX_SAFE_INTEGER) {
        throw new RangeError("Could not encode varint");
    }

    const oldOffset = offset;

    while (num >= INT) {
        buf[offset++] = (num & 0xff) | MSB;
        num /= 128;
    }
    while (num & MSBALL) {
        buf[offset++] = (num & 0xff) | MSB;
        num >>>= 7;
    }
    buf[offset] = num | 0;

    offset++;

    return { bytes: offset - oldOffset, offset: offset };
}

export function writeSigned(num: number, buf: Uint8Array, offset: number = 0): { bytes: number; offset: number } {
    num = num >= 0 ? num * 2 : num * -2 - 1;
    const result = writeUnsigned(num, buf, offset);
    return result;
}

export function readLpString(buf: Uint8Array, offset: number = 0): { str: string; bytes: number; offset: number } {
    let strLength: number;
    let bytes: number;
    ({ offset, bytes, num: strLength } = readUnsigned(buf, offset));
    const str = TEXT_DECODER.decode(buf.slice(offset, offset + strLength));

    offset += strLength;

    return { str, offset, bytes: strLength + bytes };
}

export function writeLpString(str: string, buf: Uint8Array, offset: number = 0): { bytes: number; offset: number } {
    const strBinary = TEXT_ENCODER.encode(str);
    const length = strBinary.length;
    let bytes: number;
    ({ offset, bytes } = writeUnsigned(length, buf, offset));
    buf.set(strBinary, offset);
    offset += length;
    return { offset, bytes: bytes + length };
}
