import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react';

import { Platform } from 'react-native';

// Set to true when testing on x86_64 emulator (native LLM is 10-50x slower via ARM emulation)
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
const LLM_MODEL_ID = 'qwen2.5-0.5b-instruct-q8_0';
const LLM_MODEL_NAME = 'Qwen2.5 0.5B Instruct Q8_0';
const LLM_MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q8_0.gguf';
const LLM_MODEL_MEMORY = 700_000_000;

const STT_MODEL_ID = 'sherpa-onnx-whisper-base.en';
const STT_MODEL_NAME = 'Sherpa Whisper Base (ONNX)';
const STT_MODEL_URL =
  'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-base.en.tar.gz';
const STT_MODEL_MEMORY = 150_000_000;

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

export interface VoiceSessionCallbacks {
  onTranscription: (text: string) => void;
  onResponse: (text: string) => void;
  onStateChange: (state: 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'idle' | 'error') => void;
}

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
  startVoiceSession: (systemPrompt: string, callbacks: VoiceSessionCallbacks) => Promise<void>;
  stopVoiceSession: () => Promise<void>;
  sendVoiceNow: () => Promise<void>;
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
  startVoiceSession: async () => {},
  stopVoiceSession: async () => {},
  sendVoiceNow: async () => {},
});

export function useModel() {
  return useContext(ModelContext);
}

/** Mock AI responses by parsing the pre-computed spending summary from the prompt */
function webMockGenerate(prompt: string): string {
  // Extract spending summary from the new prompt format
  const summaryMatch = prompt.match(/Spending data:\s*(.*?)(?:\n|$)/s);
  const questionMatch = prompt.match(/User question:\s*(.*?)$/s);
  const question = (questionMatch?.[1] ?? prompt).toLowerCase();
  const summary = summaryMatch?.[1] ?? '';

  // Parse total and breakdown from summary like:
  // "Total spending: ₹5,400 across 11 transactions. Breakdown: food: ₹2,450 (45%), travel: ₹1,200 (22%), ..."
  const totalMatch = summary.match(/Total spending:\s*₹([\d,]+)/);
  const txCountMatch = summary.match(/across\s+(\d+)\s+transactions/);
  const total = totalMatch ? totalMatch[1] : '0';
  const txCount = txCountMatch ? txCountMatch[1] : '0';

  // Parse category breakdown
  const breakdownMatch = summary.match(/Breakdown:\s*(.*)/);
  const breakdownStr = breakdownMatch?.[1] ?? '';
  const categories = [...breakdownStr.matchAll(/(\w+):\s*₹([\d,]+)\s*\((\d+)%\)/g)].map(m => ({
    name: m[1],
    amount: m[2],
    pct: m[3],
  }));

  if (categories.length === 0) {
    return 'I don\'t see any spending data yet. Add some transactions first, then I can help analyze your spending.';
  }

  const topCat = categories[0];

  if (question.includes('food')) {
    const food = categories.find(c => c.name === 'food');
    if (food) {
      return `You spent ₹${food.amount} on food, which is ${food.pct}% of your total spending of ₹${total}. ${parseInt(food.pct) > 30 ? 'That\'s a significant portion — consider cooking more at home to save.' : 'That\'s a reasonable portion of your budget.'}`;
    }
    return `I don't see any food-related spending in your current transactions.`;
  }

  if (question.includes('biggest') || question.includes('most') || question.includes('top') || question.includes('spend')) {
    let response = `Your biggest spending category is ${topCat.name} at ₹${topCat.amount} (${topCat.pct}% of total ₹${total}).`;
    if (categories.length > 1) {
      response += ` Followed by ${categories[1].name} at ₹${categories[1].amount} (${categories[1].pct}%).`;
    }
    if (categories.length > 2) {
      response += ` Then ${categories[2].name} at ₹${categories[2].amount} (${categories[2].pct}%).`;
    }
    return response;
  }

  if (question.includes('optim') || question.includes('cut') || question.includes('save') || question.includes('reduce')) {
    return `Your total spending is ₹${total} across ${txCount} transactions. Your top category is ${topCat.name} (₹${topCat.amount}, ${topCat.pct}%). Consider setting a weekly budget for ${topCat.name} and tracking it daily. Even a 10-15% reduction in your top 2 categories could make a noticeable difference.`;
  }

  if (question.includes('summary') || question.includes('overview') || question.includes('break')) {
    const catList = categories.map(c => `${c.name}: ₹${c.amount} (${c.pct}%)`).join(', ');
    return `You have ${txCount} transactions totaling ₹${total}. Breakdown: ${catList}.`;
  }

  if (question.includes('night') || question.includes('late')) {
    return `Based on your transactions, try planning purchases during daytime hours and avoiding impulse late-night orders to optimize your spending.`;
  }

  // Default — give a useful overview
  return `You have ${txCount} transactions totaling ₹${total}. Your top category is ${topCat.name} at ₹${topCat.amount} (${topCat.pct}%).${categories.length > 1 ? ` Next is ${categories[1].name} at ₹${categories[1].amount} (${categories[1].pct}%).` : ''} Ask me about specific categories, spending habits, or tips to save!`;
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

      console.log('[LLM] generateStream called, maxTokens:', maxTokens, 'prompt length:', prompt.length);
      const startTime = Date.now();
      const streamResult = await RunAnywhere.generateStream(prompt, {
        maxTokens,
        temperature: 0.3,
      });

      let response = '';
      let tokenCount = 0;
      for await (const token of streamResult.stream) {
        response += token;
        tokenCount++;
      }
      const elapsed = Date.now() - startTime;
      console.log('[LLM] Generation done:', tokenCount, 'tokens in', elapsed, 'ms');
      console.log('[LLM] Response:', JSON.stringify(response.substring(0, 200)));
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
  const soundRef = useRef<any>(null);

  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!RunAnywhere) return;

      if (ttsReady) {
        console.log('[TTS] Synthesizing:', text.substring(0, 60));
        const result = await RunAnywhere.synthesize(text, {
          voice: 'default',
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
        });
        console.log('[TTS] Synthesis done, creating WAV...');
        const wavPath = await RunAnywhere.Audio.createWavFromPCMFloat32(
          result.audio,
          result.sampleRate || 22050
        );
        console.log('[TTS] WAV created:', wavPath);

        // Play using expo-av and wait for completion
        const { Audio } = require('expo-av');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        const fileUri = wavPath.startsWith('file://') ? wavPath : `file://${wavPath}`;
        console.log('[TTS] Playing URI:', fileUri);
        const { sound } = await Audio.Sound.createAsync(
          { uri: fileUri },
          { shouldPlay: true, volume: 1.0 }
        );
        soundRef.current = sound;
        console.log('[TTS] Playback started');

        // Wait for playback to finish before returning
        await new Promise<void>((resolve) => {
          sound.setOnPlaybackStatusUpdate((s: any) => {
            if (s.didJustFinish) {
              console.log('[TTS] Playback finished');
              sound.unloadAsync();
              soundRef.current = null;
              resolve();
            }
          });
        });
      } else {
        // Fallback to system TTS
        console.log('[TTS] Using system fallback');
        try {
          await RunAnywhere.speak(text, { rate: 1.0, pitch: 1.0, volume: 1.0 });
        } catch {
          console.warn('[TTS] System TTS not available');
        }
      }
    },
    [ttsReady]
  );

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
        // Ensure mic permission (may have been cleared by pm clear)
        const { PermissionsAndroid, Platform: P } = require('react-native');
        if (P.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn('[STT] Microphone permission denied');
            listenCallbackRef.current = null;
            return;
          }
        }

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
        } catch (e2: any) {
          console.warn('All recording methods failed:', e2?.message || e2);
          setIsListening(false);
        }
      }
    },
    [sttReady]
  );

  const stopListening = useCallback(async (): Promise<void> => {
    console.log('[STT] stopListening called');
    setIsListening(false);

    if (!RunAnywhere || !sttReady) {
      console.log('[STT] RunAnywhere or STT not ready, aborting');
      listenCallbackRef.current = null;
      return;
    }

    try {
      let base64Audio: string | null = null;

      // Try LiveAudioStream first
      try {
        const LiveAudioStream = require('react-native-live-audio-stream').default;
        LiveAudioStream.stop();
        console.log('[STT] LiveAudioStream stopped, chunks:', audioChunksRef.current.length);

        if (audioChunksRef.current.length > 0) {
          const pcmChunks = audioChunksRef.current;
          const totalBytes = pcmChunks.reduce((sum, chunk) => {
            return sum + Math.ceil((chunk.length * 3) / 4);
          }, 0);
          console.log('[STT] Total audio bytes (est):', totalBytes, '(~', (totalBytes / 16000 / 2).toFixed(1), 'sec)');

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
        console.log('[STT] Sending to transcribe, audio base64 length:', base64Audio.length);
        const result = await RunAnywhere.transcribe(base64Audio, {
          language: 'en',
          sampleRate: 16000,
        });
        console.log('[STT] Transcribe result:', JSON.stringify(result));

        if (result?.text && listenCallbackRef.current) {
          const trimmed = result.text.trim();
          console.log('[STT] Final transcription:', JSON.stringify(trimmed));
          listenCallbackRef.current(trimmed);
        } else {
          console.log('[STT] No text in result or no callback');
          if (listenCallbackRef.current) listenCallbackRef.current('');
        }
      } else {
        console.log('[STT] No audio data captured');
        if (listenCallbackRef.current) listenCallbackRef.current('');
      }
    } catch (e: any) {
      console.error('[STT] Transcription failed:', e?.message || e);
      if (listenCallbackRef.current) listenCallbackRef.current('');
    }

    audioChunksRef.current = [];
    listenCallbackRef.current = null;
  }, [sttReady]);

  // ── Voice Session (RunAnywhere managed pipeline) ──
  const voiceSessionRef = useRef<any>(null);
  const voiceCallbacksRef = useRef<VoiceSessionCallbacks | null>(null);

  const startVoiceSession = useCallback(
    async (systemPrompt: string, callbacks: VoiceSessionCallbacks): Promise<void> => {
      if (!RunAnywhere || status !== 'ready') {
        console.warn('[VSESSION] RunAnywhere not ready');
        return;
      }

      voiceCallbacksRef.current = callbacks;

      try {
        console.log('[VSESSION] Starting voice session...');
        const session = await RunAnywhere.startVoiceSession({
          systemPrompt,
          silenceDuration: 1.5,
          speechThreshold: 0.1,
          autoPlayTTS: false,
          continuousMode: true,
          language: 'en',
          onEvent: (event: any) => {
            const cb = voiceCallbacksRef.current;
            if (!cb) return;

            // Don't log high-frequency audio level events
            if (event.type !== 'listening') {
              console.log('[VSESSION] Event:', event.type,
                event.transcription ? `t:"${event.transcription.substring(0, 50)}"` : '',
                event.response ? `r:"${event.response.substring(0, 50)}"` : '',
                event.error ? `err:${event.error}` : '');
            }

            switch (event.type) {
              case 'started':
                cb.onStateChange('listening');
                break;
              case 'listening':
                // High-frequency audio level event (20x/sec) — don't trigger state changes
                // Could be used for audio visualizer via a separate callback if needed
                break;
              case 'speechStarted':
                cb.onStateChange('listening');
                break;
              case 'speechEnded':
              case 'processing':
                cb.onStateChange('transcribing');
                break;
              case 'transcribed':
                if (event.transcription) {
                  cb.onTranscription(event.transcription);
                }
                cb.onStateChange('thinking');
                break;
              case 'responded':
                if (event.response) {
                  cb.onResponse(event.response);
                }
                break;
              case 'speaking':
                cb.onStateChange('speaking');
                break;
              case 'turnCompleted':
                cb.onStateChange('idle');
                break;
              case 'stopped':
                cb.onStateChange('idle');
                break;
              case 'error':
                console.error('[VSESSION] Error:', event.error);
                cb.onStateChange('error');
                break;
            }
          },
        });
        voiceSessionRef.current = session;
        console.log('[VSESSION] Voice session started');
      } catch (e: any) {
        console.error('[VSESSION] Failed to start:', e?.message || e);
        callbacks.onStateChange('error');
      }
    },
    [status]
  );

  const stopVoiceSession = useCallback(async (): Promise<void> => {
    if (voiceSessionRef.current) {
      try {
        console.log('[VSESSION] Stopping voice session...');
        voiceSessionRef.current.stop();
        voiceSessionRef.current.cleanup();
        console.log('[VSESSION] Voice session stopped');
      } catch (e: any) {
        console.warn('[VSESSION] Stop error:', e?.message || e);
      }
      voiceSessionRef.current = null;
      voiceCallbacksRef.current = null;
    }
  }, []);

  const sendVoiceNow = useCallback(async (): Promise<void> => {
    if (voiceSessionRef.current) {
      try {
        console.log('[VSESSION] sendNow — forcing audio processing...');
        await voiceSessionRef.current.sendNow();
      } catch (e: any) {
        console.warn('[VSESSION] sendNow error:', e?.message || e);
      }
    }
  }, []);

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
        startVoiceSession,
        stopVoiceSession,
        sendVoiceNow,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
}
