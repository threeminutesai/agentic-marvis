function readPcmSample(data, offset, bitsPerSample) {
  if (bitsPerSample === 8) {
    return ((data.readUInt8(offset) - 128) / 128);
  }
  if (bitsPerSample === 16) {
    return data.readInt16LE(offset) / 32768;
  }
  if (bitsPerSample === 24) {
    const value = data.readIntLE(offset, 3);
    return value / 8388608;
  }
  if (bitsPerSample === 32) {
    return data.readInt32LE(offset) / 2147483648;
  }
  throw new Error(`Unsupported PCM bit depth: ${bitsPerSample}`);
}

function parseWavPcm(buffer) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (data.length < 44) {
    throw new Error('Audio file is too small to be a valid WAV.');
  }

  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Only uncompressed WAV files are supported by the lightweight voice test.');
  }

  let offset = 12;
  let format = null;
  let channels = null;
  let sampleRate = null;
  let bitsPerSample = null;
  let pcmStart = null;
  let pcmLength = null;

  while (offset + 8 <= data.length) {
    const chunkId = data.toString('ascii', offset, offset + 4);
    const chunkSize = data.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkSize;
    if (chunkDataEnd > data.length) break;

    if (chunkId === 'fmt ') {
      format = data.readUInt16LE(chunkDataStart);
      channels = data.readUInt16LE(chunkDataStart + 2);
      sampleRate = data.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = data.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === 'data') {
      pcmStart = chunkDataStart;
      pcmLength = chunkSize;
      break;
    }

    offset = chunkDataEnd + (chunkSize % 2);
  }

  if (format !== 1) throw new Error('Only PCM WAV files are supported.');
  if (!channels || !sampleRate || !bitsPerSample || pcmStart == null || pcmLength == null) {
    throw new Error('Missing WAV format or data chunk.');
  }

  return {
    channels,
    sampleRate,
    bitsPerSample,
    pcm: data.subarray(pcmStart, pcmStart + pcmLength),
  };
}

function analyzeVolumeRise(buffer, {
  baselineMs = 800,
  windowMs = 120,
  ratioThreshold = 1.8,
  deltaThreshold = 0.08,
} = {}) {
  const { channels, sampleRate, bitsPerSample, pcm } = parseWavPcm(buffer);
  const bytesPerSample = bitsPerSample / 8;
  const frameSize = bytesPerSample * channels;
  const totalFrames = Math.floor(pcm.length / frameSize);
  if (!totalFrames) throw new Error('No audio samples found in WAV file.');

  const framesPerWindow = Math.max(1, Math.round(sampleRate * (windowMs / 1000)));
  const baselineFrames = Math.max(1, Math.min(totalFrames, Math.round(sampleRate * (baselineMs / 1000))));
  const windowCount = Math.max(1, Math.ceil(totalFrames / framesPerWindow));

  const levels = [];
  for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
    const startFrame = windowIndex * framesPerWindow;
    const endFrame = Math.min(totalFrames, startFrame + framesPerWindow);
    let sumSquares = 0;
    let sampleCount = 0;

    for (let frame = startFrame; frame < endFrame; frame += 1) {
      let frameSum = 0;
      for (let channel = 0; channel < channels; channel += 1) {
        const sampleOffset = (frame * frameSize) + (channel * bytesPerSample);
        frameSum += readPcmSample(pcm, sampleOffset, bitsPerSample);
      }
      const normalized = frameSum / channels;
      sumSquares += normalized * normalized;
      sampleCount += 1;
    }

    levels.push(Math.sqrt(sumSquares / Math.max(1, sampleCount)));
  }

  const baselineWindowCount = Math.max(1, Math.min(levels.length, Math.ceil(baselineFrames / framesPerWindow)));
  const baselineLevel = levels.slice(0, baselineWindowCount).reduce((sum, value) => sum + value, 0) / baselineWindowCount;
  const peakLevel = Math.max(...levels);
  const peakIndex = levels.indexOf(peakLevel);
  const peakMs = peakIndex * windowMs;
  const detected = peakLevel >= Math.max(baselineLevel * ratioThreshold, baselineLevel + deltaThreshold);

  return {
    detected,
    sampleRate,
    channels,
    bitsPerSample,
    baselineLevel,
    peakLevel,
    peakMs,
    levels,
  };
}

module.exports = {
  analyzeVolumeRise,
  parseWavPcm,
};
