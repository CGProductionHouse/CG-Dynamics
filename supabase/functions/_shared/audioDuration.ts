const EBML_ID_SEGMENT = 0x18538067
const EBML_ID_INFO = 0x1549a966
const EBML_ID_TIMECODE_SCALE = 0x2ad7b1
const EBML_ID_DURATION = 0x4489
const EBML_ID_TRACKS = 0x1654ae6b
const EBML_ID_TRACK_ENTRY = 0xae
const EBML_ID_TRACK_NUMBER = 0xd7
const EBML_ID_TRACK_TYPE = 0x83
const EBML_ID_CODEC_ID = 0x86
const EBML_ID_DEFAULT_DURATION = 0x23e383
const EBML_ID_CLUSTER = 0x1f43b675
const EBML_ID_CLUSTER_TIMECODE = 0xe7
const EBML_ID_SIMPLE_BLOCK = 0xa3
const EBML_ID_BLOCK_GROUP = 0xa0
const EBML_ID_BLOCK = 0xa1

export class AudioMetadataError extends Error {
  constructor(readonly safeCode: 'VOICE_FORMAT_UNSUPPORTED' | 'VOICE_METADATA_INVALID') {
    super(safeCode)
  }
}

type Vint = { value: number; length: number; unknown: boolean }
type Element = { id: number; start: number; end: number }

function readVint(bytes: Uint8Array, offset: number, keepMarker: boolean): Vint | null {
  if (offset >= bytes.length || bytes[offset] === 0) return null
  let mask = 0x80
  let length = 1
  while (length <= 8 && (bytes[offset] & mask) === 0) {
    mask >>= 1
    length += 1
  }
  if (length > 8 || offset + length > bytes.length) return null
  let value = keepMarker ? bytes[offset] : bytes[offset] & (mask - 1)
  let unknown = !keepMarker && (bytes[offset] & (mask - 1)) === mask - 1
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + bytes[offset + index]
    if (!keepMarker && bytes[offset + index] !== 0xff) unknown = false
  }
  if (unknown) return { value: 0, length, unknown: true }
  return Number.isSafeInteger(value) ? { value, length, unknown: false } : null
}

function elements(bytes: Uint8Array, start: number, end: number): Element[] | null {
  const result: Element[] = []
  let offset = start
  while (offset < end) {
    const id = readVint(bytes, offset, true)
    if (!id) return null
    const size = readVint(bytes, offset + id.length, false)
    if (!size) return null
    const dataStart = offset + id.length + size.length
    const dataEnd = size.unknown ? end : dataStart + size.value
    if (dataEnd < dataStart || dataEnd > end) return null
    result.push({ id: id.value, start: dataStart, end: dataEnd })
    offset = dataEnd
    if (size.unknown) break
  }
  return offset === end || result.at(-1)?.end === end ? result : null
}

function unsignedBigEndian(bytes: Uint8Array, start: number, end: number): number | null {
  const length = end - start
  if (length < 1 || length > 8) return null
  let value = 0
  for (let offset = start; offset < end; offset += 1) value = value * 256 + bytes[offset]
  return Number.isSafeInteger(value) ? value : null
}

function text(bytes: Uint8Array, start: number, end: number): string {
  return new TextDecoder().decode(bytes.subarray(start, end)).replace(/\0+$/, '')
}

function opusPacketDurationSeconds(packet: Uint8Array): number | null {
  if (packet.length < 1) return null
  const config = packet[0] >> 3
  const frameSeconds = config < 12
    ? [0.01, 0.02, 0.04, 0.06][config & 3]
    : config < 16
    ? [0.01, 0.02][config & 1]
    : [0.0025, 0.005, 0.01, 0.02][config & 3]
  const code = packet[0] & 3
  const frames = code === 0 ? 1 : code === 1 || code === 2 ? 2 : packet.length >= 2 ? packet[1] & 0x3f : 0
  const duration = frameSeconds * frames
  return frames > 0 && frames <= 48 && duration <= 0.12 + Number.EPSILON ? duration : null
}

function blockPackets(bytes: Uint8Array, start: number, end: number): { track: number; relativeTimecode: number; packets: Uint8Array[] } | null {
  const track = readVint(bytes, start, false)
  if (!track || track.unknown || track.value <= 0 || start + track.length + 3 > end) return null
  let offset = start + track.length
  const relativeTimecode = new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getInt16(0, false)
  offset += 2
  const flags = bytes[offset++]
  const lacing = (flags >> 1) & 3
  if (offset >= end) return null
  if (lacing === 0) return { track: track.value, relativeTimecode, packets: [bytes.subarray(offset, end)] }

  const packetCount = bytes[offset++] + 1
  if (packetCount < 2 || offset > end) return null
  const sizes: number[] = []
  if (lacing === 2) {
    const remaining = end - offset
    if (remaining % packetCount !== 0) return null
    for (let index = 0; index < packetCount - 1; index += 1) sizes.push(remaining / packetCount)
  } else if (lacing === 1) {
    for (let index = 0; index < packetCount - 1; index += 1) {
      let size = 0
      while (offset < end) {
        const part = bytes[offset++]
        size += part
        if (part !== 255) break
      }
      sizes.push(size)
    }
  } else {
    const first = readVint(bytes, offset, false)
    if (!first || first.unknown) return null
    sizes.push(first.value)
    offset += first.length
    for (let index = 1; index < packetCount - 1; index += 1) {
      const encoded = readVint(bytes, offset, false)
      if (!encoded || encoded.unknown) return null
      offset += encoded.length
      const bias = 2 ** (7 * encoded.length - 1) - 1
      const size = sizes[index - 1] + encoded.value - bias
      if (size < 0) return null
      sizes.push(size)
    }
  }
  const knownSize = sizes.reduce((sum, size) => sum + size, 0)
  const lastSize = end - offset - knownSize
  if (lastSize <= 0) return null
  sizes.push(lastSize)
  const packets: Uint8Array[] = []
  for (const size of sizes) {
    if (size <= 0 || offset + size > end) return null
    packets.push(bytes.subarray(offset, offset + size))
    offset += size
  }
  return offset === end ? { track: track.value, relativeTimecode, packets } : null
}

export function parseWebmDurationSeconds(bytes: Uint8Array): number | null {
  if (bytes.length < 16 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) return null
  const root = elements(bytes, 0, bytes.length)
  const segment = root?.find(element => element.id === EBML_ID_SEGMENT)
  if (!segment) return null
  const segmentElements = elements(bytes, segment.start, segment.end)
  if (!segmentElements) return null

  let timecodeScale = 1_000_000
  let metadataSeconds: number | null = null
  const info = segmentElements.find(element => element.id === EBML_ID_INFO)
  if (info) {
    const children = elements(bytes, info.start, info.end)
    if (!children) return null
    for (const child of children) {
      if (child.id === EBML_ID_TIMECODE_SCALE) {
        const value = unsignedBigEndian(bytes, child.start, child.end)
        if (!value || value > 1_000_000_000) return null
        timecodeScale = value
      } else if (child.id === EBML_ID_DURATION) {
        const length = child.end - child.start
        if (length !== 4 && length !== 8) return null
        const view = new DataView(bytes.buffer, bytes.byteOffset + child.start, length)
        const value = length === 4 ? view.getFloat32(0, false) : view.getFloat64(0, false)
        metadataSeconds = value * timecodeScale / 1_000_000_000
        if (!Number.isFinite(metadataSeconds) || metadataSeconds <= 0) return null
      }
    }
  }

  const tracksElement = segmentElements.find(element => element.id === EBML_ID_TRACKS)
  if (!tracksElement) return null
  const trackEntries = elements(bytes, tracksElement.start, tracksElement.end)
  if (!trackEntries) return null
  const audioTracks = new Map<number, number | null>()
  for (const entry of trackEntries.filter(element => element.id === EBML_ID_TRACK_ENTRY)) {
    const fields = elements(bytes, entry.start, entry.end)
    if (!fields) return null
    const numberField = fields.find(field => field.id === EBML_ID_TRACK_NUMBER)
    const typeField = fields.find(field => field.id === EBML_ID_TRACK_TYPE)
    const codecField = fields.find(field => field.id === EBML_ID_CODEC_ID)
    if (!numberField || !typeField || !codecField) return null
    const number = unsignedBigEndian(bytes, numberField.start, numberField.end)
    const type = unsignedBigEndian(bytes, typeField.start, typeField.end)
    if (!number || type !== 2) continue
    if (text(bytes, codecField.start, codecField.end) !== 'A_OPUS') return null
    const defaultField = fields.find(field => field.id === EBML_ID_DEFAULT_DURATION)
    const defaultDuration = defaultField ? unsignedBigEndian(bytes, defaultField.start, defaultField.end) : null
    if (defaultField && (!defaultDuration || defaultDuration > 120_000_000)) return null
    audioTracks.set(number, defaultDuration === null ? null : defaultDuration / 1_000_000_000)
  }
  if (audioTracks.size !== 1) return null

  let encodedSeconds = 0
  let sawAudioBlock = false
  const visitBlock = (block: Element, clusterTimecode: number): boolean => {
    const parsed = blockPackets(bytes, block.start, block.end)
    if (!parsed) return false
    if (!audioTracks.has(parsed.track)) return true
    let packetDuration = 0
    for (const packet of parsed.packets) {
      const duration = opusPacketDurationSeconds(packet) ?? audioTracks.get(parsed.track)
      if (!duration) return false
      packetDuration += duration
    }
    const startSeconds = (clusterTimecode + parsed.relativeTimecode) * timecodeScale / 1_000_000_000
    if (!Number.isFinite(startSeconds) || startSeconds < 0) return false
    encodedSeconds = Math.max(encodedSeconds, startSeconds + packetDuration)
    sawAudioBlock = true
    return true
  }
  for (const cluster of segmentElements.filter(element => element.id === EBML_ID_CLUSTER)) {
    const children = elements(bytes, cluster.start, cluster.end)
    if (!children) return null
    const timecodeField = children.find(child => child.id === EBML_ID_CLUSTER_TIMECODE)
    const clusterTimecode = timecodeField ? unsignedBigEndian(bytes, timecodeField.start, timecodeField.end) : 0
    if (clusterTimecode === null) return null
    for (const child of children) {
      if (child.id === EBML_ID_SIMPLE_BLOCK && !visitBlock(child, clusterTimecode)) return null
      if (child.id === EBML_ID_BLOCK_GROUP) {
        const group = elements(bytes, child.start, child.end)
        const block = group?.find(field => field.id === EBML_ID_BLOCK)
        if (!group || !block || !visitBlock(block, clusterTimecode)) return null
      }
    }
  }
  if (!sawAudioBlock || encodedSeconds <= 0) return null
  if (metadataSeconds !== null) {
    const mismatch = Math.abs(metadataSeconds - encodedSeconds)
    if (mismatch > Math.max(2, encodedSeconds * 0.1)) return null
  }
  return Math.max(metadataSeconds ?? 0, encodedSeconds)
}

type Box = { type: string; start: number; end: number }

function boxes(bytes: Uint8Array, start: number, end: number): Box[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const result: Box[] = []
  let offset = start
  while (offset < end) {
    if (offset + 8 > end) return null
    let size = view.getUint32(offset, false)
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    let header = 8
    if (size === 1) {
      if (offset + 16 > end) return null
      size = view.getUint32(offset + 8, false) * 0x1_0000_0000 + view.getUint32(offset + 12, false)
      header = 16
    } else if (size === 0) size = end - offset
    if (!Number.isSafeInteger(size) || size < header || offset + size > end) return null
    result.push({ type, start: offset + header, end: offset + size })
    offset += size
  }
  return offset === end ? result : null
}

function mediaHeader(view: DataView, box: Box): { timescale: number; duration: number } | null {
  if (box.end - box.start < 20) return null
  const version = view.getUint8(box.start)
  const offset = version === 1 ? box.start + 20 : version === 0 ? box.start + 12 : -1
  if (offset < 0 || offset + (version === 1 ? 12 : 8) > box.end) return null
  const timescale = view.getUint32(offset, false)
  const duration = version === 1
    ? view.getUint32(offset + 4, false) * 0x1_0000_0000 + view.getUint32(offset + 8, false)
    : view.getUint32(offset + 4, false)
  return timescale > 0 && duration > 0 && Number.isSafeInteger(duration) ? { timescale, duration } : null
}

function sttsDuration(view: DataView, box: Box): number | null {
  if (box.end - box.start < 8) return null
  const count = view.getUint32(box.start + 4, false)
  if (count < 1 || box.start + 8 + count * 8 !== box.end) return null
  let duration = 0
  for (let index = 0; index < count; index += 1) {
    const offset = box.start + 8 + index * 8
    const samples = view.getUint32(offset, false)
    const delta = view.getUint32(offset + 4, false)
    if (samples < 1 || delta < 1) return null
    duration += samples * delta
    if (!Number.isSafeInteger(duration)) return null
  }
  return duration > 0 ? duration : null
}

export function parseMp4DurationSeconds(bytes: Uint8Array): number | null {
  if (bytes.length < 16) return null
  const root = boxes(bytes, 0, bytes.length)
  if (!root?.some(box => box.type === 'ftyp')) return null
  const moov = root.find(box => box.type === 'moov')
  if (!moov) return null
  const moovChildren = boxes(bytes, moov.start, moov.end)
  if (!moovChildren) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const durations: number[] = []
  for (const trak of moovChildren.filter(box => box.type === 'trak')) {
    const trakChildren = boxes(bytes, trak.start, trak.end)
    const mdia = trakChildren?.find(box => box.type === 'mdia')
    if (!trakChildren || !mdia) return null
    const mdiaChildren = boxes(bytes, mdia.start, mdia.end)
    if (!mdiaChildren) return null
    const hdlr = mdiaChildren.find(box => box.type === 'hdlr')
    if (!hdlr || hdlr.end - hdlr.start < 12) return null
    const handler = String.fromCharCode(bytes[hdlr.start + 8], bytes[hdlr.start + 9], bytes[hdlr.start + 10], bytes[hdlr.start + 11])
    if (handler !== 'soun') continue
    const mdhd = mdiaChildren.find(box => box.type === 'mdhd')
    const minf = mdiaChildren.find(box => box.type === 'minf')
    const header = mdhd ? mediaHeader(view, mdhd) : null
    const minfChildren = minf ? boxes(bytes, minf.start, minf.end) : null
    const stbl = minfChildren?.find(box => box.type === 'stbl')
    const stblChildren = stbl ? boxes(bytes, stbl.start, stbl.end) : null
    const stts = stblChildren?.find(box => box.type === 'stts')
    const samples = stts ? sttsDuration(view, stts) : null
    if (!header || !samples) return null
    const metadataSeconds = header.duration / header.timescale
    const encodedSeconds = samples / header.timescale
    if (!Number.isFinite(encodedSeconds) || encodedSeconds <= 0 || Math.abs(metadataSeconds - encodedSeconds) > Math.max(0.001, encodedSeconds / header.timescale)) return null
    durations.push(Math.max(metadataSeconds, encodedSeconds))
  }
  return durations.length > 0 ? Math.max(...durations) : null
}

export async function deriveAudioDurationSeconds(audio: File): Promise<number> {
  const mime = audio.type.toLowerCase().split(';', 1)[0].trim()
  const bytes = new Uint8Array(await audio.arrayBuffer())
  const duration = mime === 'audio/webm' || mime === 'video/webm'
    ? parseWebmDurationSeconds(bytes)
    : mime === 'audio/mp4' || mime === 'video/mp4' || mime === 'audio/m4a' || mime === 'audio/x-m4a'
    ? parseMp4DurationSeconds(bytes)
    : undefined
  if (duration === undefined) throw new AudioMetadataError('VOICE_FORMAT_UNSUPPORTED')
  if (duration === null) throw new AudioMetadataError('VOICE_METADATA_INVALID')
  return duration
}
