import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react';

import { Platform } from 'react-native';

// Set to true when testing on x86_64 emulator (native LLM crashes on emulator)
const FORCE_MOCK_LLM = false;

// RunAnywhere imports — only available on native (Android/iOS)
let RunAnywhere: any = null;
let SDKEnvironment: any = null;
let ModelCategory: any = null;
let ModelArtifactType: any = null;
let LlamaCPP: any = null;
let ONNX: any = null;

if (Platform.OS !== 'web') {
  try {
    const core = require('@runanywhere/core');
    RunAnywhere = core.RunAnywhere;
    SDKEnvironment = core.SDKEnvironment;
    ModelCategory = core.ModelCategory;
    const onnxModule = require('@runanywhere/onnx');
    ONNX = onnxModule.ONNX;
    ModelArtifactType = onnxModule.ModelArtifactType;
    LlamaCPP = require('@runanywhere/llamacpp').LlamaCPP;
  } catch (e) {
    console.warn('RunAnywhere SDK not available on this platform');
  }
}

// ── Model IDs ──
const LLM_MODEL_ID = 'lfm2-350m-q4_k_m';
const LLM_MODEL_NAME = 'LFM2 350M Q4_K_M';
const LLM_MODEL_URL =
  'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q4_K_M.gguf';
const LLM_MODEL_MEMORY = 250_000_000;

const STT_MODEL_ID = 'sherpa-onnx-whisper-tiny.en';
const STT_MODEL_NAME = 'Sherpa Whisper Tiny (ONNX)';
const STT_MODEL_URL =
  'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.en.tar.gz';
const STT_MODEL_MEMORY = 75_000_000;

const TTS_MODEL_ID = 'vits-piper-en_US-lessac-medium';
const TTS_MODEL_NAME = 'Piper TTS (US English - Medium)';
const TTS_MODEL_URL =
  'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz';
const TTS_MODEL_MEMORY = 65_000_000;

export type ModelStatus =
  | 'uninitialized'
  | 'initializing'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'error';

interface ModelContextValue {
  status: ModelStatus;
  downloadProgress: number;
  error: string | null;
  sttReady: boolean;
  ttsReady: boolean;
  initializeModel: () => Promise<void>;
  generate: (prompt: string, maxTokens?: number) => Promise<string>;
  transcribe: (audioSamples: Float32Array) => Promise<string>;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  startListening: (onResult: (text: string) => void) => Promise<void>;
  stopListening: () => Promise<void>;
  isListening: boolean;
}

const ModelContext = createContext<ModelContextValue>({
  status: 'uninitialized',
  downloadProgress: 0,
  error: null,
  sttReady: false,
  ttsReady: false,
  initializeModel: async () => {},
  generate: async () => '',
  transcribe: async () => '',
  speak: async () => {},
  stopSpeaking: async () => {},
  startListening: async () => {},
  stopListening: async () => {},
  isListening: false,
});

export function useModel() {
  return useContext(ModelContext);
}

/** Web-only: generate mock AI responses by parsing the prompt for transaction data */
function webMockGenerate(prompt: string): string {
  // Try to extract transaction JSON from the prompt
  const jsonMatch = prompt.match(/Transactions:\s*(\[[\s\S]*?\])/);
  if (!jsonMatch) {
    return 'I can see your spending data. Try asking about specific categories, time periods, or spending patterns.';
  }

  try {
    const txs: { amount: number; category: string; date: string; note?: string }[] =
      JSON.parse(jsonMatch[1]);
    const total = txs.reduce((s, t) => s + t.amount, 0);
    const categories: Record<string, number> = {};
    txs.forEach((t) => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const topCat = sorted[0];
    const question = prompt.toLowerCase();

    if (question.includes('food')) {
      const foodTotal = categories['food'] ?? 0;
      return `You spent ₹${foodTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} on food across ${txs.filter((t) => t.category === 'food').length} transactions. ${foodTotal > total * 0.3 ? 'That\'s over 30% of your total spending — consider cooking more at home.' : 'That\'s a reasonable portion of your budget.'}`;
    }

    if (question.includes('biggest') || question.includes('most') || question.includes('top')) {
      return `Your biggest spending category is ${topCat[0]} at ₹${topCat[1].toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${Math.round((topCat[1] / total) * 100)}% of total). ${sorted.length > 1 ? `Followed by ${sorted[1][0]} at ₹${sorted[1][1].toLocaleString('en-IN', { minimumFractionDigits: 2 })}.` : ''}`;
    }

    if (question.includes('optim') || question.includes('cut') || question.includes('save') || question.includes('reduce')) {
      return `Your total spending is ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Your top category is ${topCat[0]} (₹${topCat[1].toLocaleString('en-IN', { minimumFractionDigits: 2 })}). Consider setting a weekly budget for ${topCat[0]} and tracking it daily. Small reductions of 10-15% in your top 2 categories could save you ₹${Math.round(total * 0.12).toLocaleString('en-IN')} per period.`;
    }

    if (question.includes('night') || question.includes('late')) {
      return `Based on your transaction timestamps, I can see spending across different times of day. To optimize, try planning purchases during daytime hours and avoiding impulse late-night orders.`;
    }

    if (question.includes('summary') || question.includes('overview')) {
      const catList = sorted.map(([c, v]) => `${c}: ₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`).join(', ');
      return `You have ${txs.length} transactions totaling ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Breakdown: ${catList}.`;
    }

    // Default
    return `You have ${txs.length} transactions totaling ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Your top spending category is ${topCat[0]} at ₹${topCat[1].toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Ask me about specific categories, spending habits, or optimization tips!`;
  } catch {
    return 'I can analyze your spending data. Try asking about specific categories, time periods, or how to optimize your budget.';
  }
}

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ModelStatus>('uninitialized');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sttReady, setSttReady] = useState(false);
  const [ttsReady, setTtsReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const initializedRef = useRef(false);
  const listeningRef = useRef(false);
  const listenCallbackRef = useRef<((text: string) => void) | null>(null);

  const initializeModel = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      if (!RunAnywhere) {
        // Web preview — skip native SDK, go straight to ready with mock generate
        console.log('Web preview mode — AI responses will be generated from transaction data');
        setStatus('ready');
        return;
      }

      setStatus('initializing');

      // Initialize SDK
      await RunAnywhere.initialize({
        environment: SDKEnvironment.Development,
      });
      LlamaCPP.register();
      ONNX.register();

      // ── Register all models ──
      await LlamaCPP.addModel({
        id: LLM_MODEL_ID,
        name: LLM_MODEL_NAME,
        url: LLM_MODEL_URL,
        memoryRequirement: LLM_MODEL_MEMORY,
      });

      await ONNX.addModel({
        id: STT_MODEL_ID,
        name: STT_MODEL_NAME,
        url: STT_MODEL_URL,
        modality: ModelCategory.SpeechRecognition,
        artifactType: ModelArtifactType.TarGzArchive,
        memoryRequirement: STT_MODEL_MEMORY,
      });

      await ONNX.addModel({
        id: TTS_MODEL_ID,
        name: TTS_MODEL_NAME,
        url: TTS_MODEL_URL,
        modality: ModelCategory.SpeechSynthesis,
        artifactType: ModelArtifactType.TarGzArchive,
        memoryRequirement: TTS_MODEL_MEMORY,
      });

      // ── Download all models ──
      setStatus('downloading');

      const modelIds = [LLM_MODEL_ID, STT_MODEL_ID, TTS_MODEL_ID];
      let completed = 0;

      for (const id of modelIds) {
        const info = await RunAnywhere.getModelInfo(id);
        if (!info?.localPath) {
          await RunAnywhere.downloadModel(id, (p: { progress: number }) => {
            // Weighted progress across all models
            const modelProgress = (completed + p.progress) / modelIds.length;
            setDownloadProgress(modelProgress);
          });
        }
        completed++;
        setDownloadProgress(completed / modelIds.length);
      }

      // ── Load all models ──
      setStatus('loading');
      console.log('[SpendAI] Loading models...');

      // Load LLM
      const llmInfo = await RunAnywhere.getModelInfo(LLM_MODEL_ID);
      console.log('[SpendAI] LLM info:', JSON.stringify({ localPath: llmInfo?.localPath }));
      if (!llmInfo?.localPath) throw new Error('LLM localPath missing');
      console.log('[SpendAI] Loading LLM...');
      await RunAnywhere.loadModel(llmInfo.localPath);
      console.log('[SpendAI] LLM loaded!');

      // Load STT (Whisper)
      try {
        const sttInfo = await RunAnywhere.getModelInfo(STT_MODEL_ID);
        console.log('[SpendAI] STT info:', JSON.stringify({ localPath: sttInfo?.localPath }));
        if (sttInfo?.localPath) {
          console.log('[SpendAI] Loading STT...');
          await RunAnywhere.loadSTTModel(sttInfo.localPath, 'whisper');
          setSttReady(true);
          console.log('[SpendAI] STT loaded!');
        }
      } catch (e) {
        console.warn('[SpendAI] STT model load failed:', e);
      }

      // Load TTS (Piper)
      try {
        const ttsInfo = await RunAnywhere.getModelInfo(TTS_MODEL_ID);
        console.log('[SpendAI] TTS info:', JSON.stringify({ localPath: ttsInfo?.localPath }));
        if (ttsInfo?.localPath) {
          console.log('[SpendAI] Loading TTS...');
          await RunAnywhere.loadTTSModel(ttsInfo.localPath, 'piper');
          setTtsReady(true);
          console.log('[SpendAI] TTS loaded!');
        }
      } catch (e) {
        console.warn('[SpendAI] TTS model load failed:', e);
      }

      console.log('[SpendAI] All models loaded, status → ready');
      setStatus('ready');
    } catch (err: any) {
      console.error('Model init error:', err);
      setError(err?.message ?? 'Unknown error');
      setStatus('error');
      initializedRef.current = false;
    }
  }, []);

  // ── LLM generate ──
  const generate = useCallback(
    async (prompt: string, maxTokens: number = 256): Promise<string> => {
      if (status !== 'ready') throw new Error('Model not ready');

      // Web preview — mock responses by analyzing the prompt
      if (!RunAnywhere) {
        await new Promise((r) => setTimeout(r, 800)); // simulate latency
        return webMockGenerate(prompt);
      }

      if (FORCE_MOCK_LLM) {
        await new Promise((r) => setTimeout(r, 800));
        return webMockGenerate(prompt);
      }

      const streamResult = await RunAnywhere.generateStream(prompt, {
        maxTokens,
        temperature: 0.8,
      });

      let response = '';
      for await (const token of streamResult.stream) {
        response += token;
      }
      return response || webMockGenerate(prompt);
    },
    [status]
  );

  // ── STT transcribe from Float32Array ──
  const transcribe = useCallback(
    async (audioSamples: Float32Array): Promise<string> => {
      if (!sttReady || !RunAnywhere) return '';
      const result = await RunAnywhere.transcribeBuffer(audioSamples, {
        language: 'en',
        sampleRate: 16000,
      });
      return result?.text ?? '';
    },
    [sttReady]
  );

  // ── TTS speak ──
  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!RunAnywhere) return;

      if (ttsReady) {
        // Use on-device Piper TTS
        const result = await RunAnywhere.synthesize(text, {
          voice: 'default',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
        });
        const wavPath = await RunAnywhere.Audio.createWavFromPCMFloat32(
          result.audio,
          result.sampleRate || 22050
        );
        // Play using expo-av since react-native-sound is not installed
        const { Audio } = require('expo-av');
        const { sound } = await Audio.Sound.createAsync(
          { uri: wavPath },
          { shouldPlay: true }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((s: any) => {
          if (s.didJustFinish) {
            sound.unloadAsync();
            soundRef.current = null;
          }
        });
      } else {
        // Fallback to system TTS
        try {
          await RunAnywhere.speak(text, { rate: 1.0, pitch: 1.0, volume: 1.0 });
        } catch {
          console.warn('TTS not available');
        }
      }
    },
    [ttsReady]
  );

  const soundRef = useRef<any>(null);

  const stopSpeaking = useCallback(async (): Promise<void> => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch {}
    }
  }, []);

  // ── Record with react-native-live-audio-stream (raw PCM) + transcribe ──
  const audioChunksRef = useRef<string[]>([]);

  const startListening = useCallback(
    async (onResult: (text: string) => void): Promise<void> => {
      if (!RunAnywhere || !sttReady) return;

      listenCallbackRef.current = onResult;
      audioChunksRef.current = [];

      try {
        const LiveAudioStream = require('react-native-live-audio-stream').default;

        LiveAudioStream.init({
          sampleRate: 16000,
          channels: 1,
          bitsPerSample: 16,
          audioSource: 6, // VOICE_RECOGNITION
        });

        LiveAudioStream.on('data', (base64Chunk: string) => {
          audioChunksRef.current.push(base64Chunk);
        });

        LiveAudioStream.start();
        setIsListening(true);
      } catch (e) {
        console.warn('LiveAudioStream failed, trying expo-av fallback:', e);
        // Fallback to expo-av
        try {
          const { Audio } = require('expo-av');
          const { granted } = await Audio.requestPermissionsAsync();
          if (!granted) return;
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
          const recording = new Audio.Recording();
          await recording.prepareToRecordAsync({
            android: {
              extension: '.m4a',
              outputFormat: 2,
              audioEncoder: 3,
              sampleRate: 16000,
              numberOfChannels: 1,
              bitRate: 128000,
            },
            ios: {
              extension: '.wav',
              outputFormat: 'linearPCM' as any,
              audioQuality: 127,
              sampleRate: 16000,
              numberOfChannels: 1,
              bitRate: 128000,
              linearPCMBitDepth: 16,
              linearPCMIsBigEndian: false,
              linearPCMIsFloat: false,
            },
            web: {},
          });
          await recording.startAsync();
          audioChunksRef.current = []; // mark as expo-av mode
          (audioChunksRef as any)._expoRecording = recording;
          setIsListening(true);
        } catch (e2) {
          console.warn('All recording methods failed:', e2);
          setIsListening(false);
        }
      }
    },
    [sttReady]
  );

  const stopListening = useCallback(async (): Promise<void> => {
    setIsListening(false);

    if (!RunAnywhere || !sttReady) {
      listenCallbackRef.current = null;
      return;
    }

    try {
      let base64Audio: string | null = null;

      // Try LiveAudioStream first
      try {
        const LiveAudioStream = require('react-native-live-audio-stream').default;
        LiveAudioStream.stop();

        if (audioChunksRef.current.length > 0) {
          // Combine PCM chunks and create a WAV with proper header
          const pcmChunks = audioChunksRef.current;
          const totalBytes = pcmChunks.reduce((sum, chunk) => {
            return sum + Math.ceil((chunk.length * 3) / 4); // base64 → bytes estimate
          }, 0);

          // Write PCM data to a temp file, then create WAV
          const RNFS = require('react-native-fs');
          const pcmPath = RNFS.CachesDirectoryPath + '/recording_pcm.raw';
          const wavPath = RNFS.CachesDirectoryPath + '/recording.wav';

          // Write all PCM chunks to file
          for (let i = 0; i < pcmChunks.length; i++) {
            if (i === 0) {
              await RNFS.writeFile(pcmPath, pcmChunks[i], 'base64');
            } else {
              await RNFS.appendFile(pcmPath, pcmChunks[i], 'base64');
            }
          }

          // Read raw PCM data
          const pcmBase64 = await RNFS.readFile(pcmPath, 'base64');
          const pcmBytes = atob(pcmBase64);
          const dataLength = pcmBytes.length;

          // Create WAV header (44 bytes)
          const sampleRate = 16000;
          const numChannels = 1;
          const bitsPerSample = 16;
          const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
          const blockAlign = numChannels * (bitsPerSample / 8);

          const header = new ArrayBuffer(44);
          const view = new DataView(header);
          // RIFF
          view.setUint32(0, 0x52494646, false); // "RIFF"
          view.setUint32(4, 36 + dataLength, true);
          view.setUint32(8, 0x57415645, false); // "WAVE"
          // fmt
          view.setUint32(12, 0x666D7420, false); // "fmt "
          view.setUint32(16, 16, true); // chunk size
          view.setUint16(20, 1, true); // PCM format
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, byteRate, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, bitsPerSample, true);
          // data
          view.setUint32(36, 0x64617461, false); // "data"
          view.setUint32(40, dataLength, true);

          // Convert header to base64
          const headerBytes = new Uint8Array(header);
          let headerStr = '';
          for (let i = 0; i < headerBytes.length; i++) {
            headerStr += String.fromCharCode(headerBytes[i]);
          }
          const headerBase64 = btoa(headerStr);

          // Write WAV file (header + PCM data)
          await RNFS.writeFile(wavPath, headerBase64, 'base64');
          await RNFS.appendFile(wavPath, pcmBase64, 'base64');

          base64Audio = await RNFS.readFile(wavPath, 'base64');

          // Cleanup
          await RNFS.unlink(pcmPath).catch(() => {});
          await RNFS.unlink(wavPath).catch(() => {});
        }
      } catch (e) {
        console.warn('LiveAudioStream stop failed:', e);
      }

      // Transcribe
      if (base64Audio) {
        const result = await RunAnywhere.transcribe(base64Audio, {
          language: 'en',
          sampleRate: 16000,
        });

        if (result?.text && listenCallbackRef.current) {
          listenCallbackRef.current(result.text.trim());
        }
      }
    } catch (e) {
      console.warn('Transcription failed:', e);
    }

    audioChunksRef.current = [];
    listenCallbackRef.current = null;
  }, [sttReady]);

  return (
    <ModelContext.Provider
      value={{
        status,
        downloadProgress,
        error,
        sttReady,
        ttsReady,
        initializeModel,
        generate,
        transcribe,
        speak,
        stopSpeaking,
        startListening,
        stopListening,
        isListening,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
}
