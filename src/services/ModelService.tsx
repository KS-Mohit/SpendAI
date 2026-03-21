import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react';

import { Platform } from 'react-native';

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
const LLM_MODEL_ID = 'lfm2-350m-q8_0';
const LLM_MODEL_NAME = 'LFM2 350M';
const LLM_MODEL_URL =
  'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q8_0.gguf';
const LLM_MODEL_MEMORY = 400_000_000;

const STT_MODEL_ID = 'whisper-tiny-en';
const STT_MODEL_NAME = 'Whisper Tiny English';
const STT_MODEL_URL =
  'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.en.tar.gz';
const STT_MODEL_MEMORY = 75_000_000;

const TTS_MODEL_ID = 'piper-en-lessac';
const TTS_MODEL_NAME = 'Piper English (Lessac)';
const TTS_MODEL_URL =
  'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz';
const TTS_MODEL_MEMORY = 65_000_000;

const VAD_MODEL_ID = 'silero-vad';
const VAD_MODEL_NAME = 'Silero VAD';
const VAD_MODEL_URL =
  'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/silero-vad.tar.gz';
const VAD_MODEL_MEMORY = 5_000_000;

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

      await ONNX.addModel({
        id: VAD_MODEL_ID,
        name: VAD_MODEL_NAME,
        url: VAD_MODEL_URL,
        modality: ModelCategory.Audio,
        artifactType: ModelArtifactType.TarGzArchive,
        memoryRequirement: VAD_MODEL_MEMORY,
      });

      // ── Download all models ──
      setStatus('downloading');

      const modelIds = [LLM_MODEL_ID, STT_MODEL_ID, TTS_MODEL_ID, VAD_MODEL_ID];
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

      // Load LLM
      const llmInfo = await RunAnywhere.getModelInfo(LLM_MODEL_ID);
      if (!llmInfo?.localPath) throw new Error('LLM localPath missing');
      await RunAnywhere.loadModel(llmInfo.localPath);

      // Load STT (Whisper)
      try {
        const sttInfo = await RunAnywhere.getModelInfo(STT_MODEL_ID);
        if (sttInfo?.localPath) {
          await RunAnywhere.loadSTTModel(sttInfo.localPath, 'whisper');
          setSttReady(true);
        }
      } catch (e) {
        console.warn('STT model load failed:', e);
      }

      // Load TTS (Piper)
      try {
        const ttsInfo = await RunAnywhere.getModelInfo(TTS_MODEL_ID);
        if (ttsInfo?.localPath) {
          await RunAnywhere.loadTTSModel(ttsInfo.localPath, 'piper');
          setTtsReady(true);
        }
      } catch (e) {
        console.warn('TTS model load failed:', e);
      }

      // Load VAD (Silero)
      try {
        const vadInfo = await RunAnywhere.getModelInfo(VAD_MODEL_ID);
        if (vadInfo?.localPath) {
          await RunAnywhere.loadVADModel(vadInfo.localPath);
        }
      } catch (e) {
        console.warn('VAD model load failed:', e);
      }

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

      const streamResult = await RunAnywhere.generateStream(prompt, {
        maxTokens,
        temperature: 0.8,
      });

      let response = '';
      for await (const token of streamResult.stream) {
        response += token;
      }
      return response;
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
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
        });
        const wavBase64 = RunAnywhere.Audio.createWavFromPCMFloat32(
          result.audio,
          result.sampleRate
        );
        await RunAnywhere.Audio.playAudio(wavBase64);
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

  const stopSpeaking = useCallback(async (): Promise<void> => {
    if (!RunAnywhere) return;
    try {
      await RunAnywhere.Audio.stopPlayback();
    } catch {
      try { await RunAnywhere.stopSpeaking(); } catch {}
    }
  }, []);

  // ── VAD-based listening: start VAD, collect speech, transcribe ──
  const startListening = useCallback(
    async (onResult: (text: string) => void): Promise<void> => {
      if (!RunAnywhere || !sttReady) return;

      listeningRef.current = true;
      setIsListening(true);
      listenCallbackRef.current = onResult;

      try {
        // Set up VAD callback to capture speech segments
        RunAnywhere.setVADSpeechActivityCallback(
          async (event: { type: string; audioBuffer?: number[] }) => {
            if (
              event.type === 'speechEnded' &&
              event.audioBuffer &&
              listeningRef.current
            ) {
              const samples = new Float32Array(event.audioBuffer);
              const result = await RunAnywhere.transcribeBuffer(samples, {
                language: 'en',
                sampleRate: 16000,
              });
              if (result?.text && listenCallbackRef.current) {
                listenCallbackRef.current(result.text.trim());
              }
            }
          }
        );

        await RunAnywhere.startVAD();
      } catch (e) {
        console.warn('VAD start failed:', e);
        setIsListening(false);
        listeningRef.current = false;
      }
    },
    [sttReady]
  );

  const stopListening = useCallback(async (): Promise<void> => {
    listeningRef.current = false;
    setIsListening(false);
    listenCallbackRef.current = null;

    if (!RunAnywhere) return;
    try {
      await RunAnywhere.stopVAD();
    } catch {}
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
      }}
    >
      {children}
    </ModelContext.Provider>
  );
}
