export type SpeakerStatus = 'empty' | 'captured' | 'analyzed' | 'response_ready' | 'responded';

export type SourceType = 'manual_paste' | 'clipboard' | 'ocr_text' | 'meeting_transcript' | 'future_asr' | 'image_upload';

export type AIProvider = 'openai_responses' | 'xiaomi_mimo' | 'openai_compatible';

export type GeneratedBy = AIProvider | 'openai' | 'local';

export type Theme = {
  id: string;
  name: string;
  core: string;
  observationQuestions: string[];
  commonMistakes: string[];
};

export type Story = {
  id: string;
  title: string;
  summary: string;
  fitFor: string[];
  sayLevel: string;
  avoidDetails: string[];
};

export type ContentSnippet = {
  id: string;
  sourceType: SourceType;
  text: string;
  createdAt: string;
  imageDataUrl?: string;
  mimeType?: string;
  fileName?: string;
};

export type SpeakerInsight = {
  strongestPoint: string;
  underlyingPattern: string;
  themeConnection: string;
  stuckType: string;
  seenNeed: string;
  suggestedObserverStory: string;
  storyUseBoundary: string;
  twentySecondResponse: string;
  oneMinuteResponse: string;
  deepResponse: string;
  powerfulQuestion: string;
  goldenSentence: string;
  doNotSay: string[];
  generatedBy?: GeneratedBy;
};

export type SpeakerCard = {
  id: string;
  name: string;
  status: SpeakerStatus;
  snippets: ContentSnippet[];
  insight?: SpeakerInsight;
  actualResponse?: string;
};

export type WholeSessionSummary = {
  commonTheme: string;
  speakerLessons: Array<{
    speakerName: string;
    lesson: string;
    themeConnection: string;
  }>;
  unifiedResponseAngle: string;
  finalSummary: string;
  goldenSentences: string[];
  closingSentence: string;
  missingSpeakers: string[];
  generatedBy?: GeneratedBy;
};

export type ObserverSession = {
  id: string;
  title: string;
  themeId: string;
  observerStance: string;
  speakers: SpeakerCard[];
  stories: Story[];
  summary?: WholeSessionSummary;
  updatedAt: string;
};

export type AppSettings = {
  provider: AIProvider;
  apiKey: string;
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
};

export type ObserverAPI = {
  readClipboardText: () => Promise<string>;
  writeClipboardText: (text: string) => Promise<boolean>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: { provider: AIProvider; apiKey: string; baseUrl: string; model: string }) => Promise<AppSettings>;
  analyzeSpeaker: (payload: unknown) => Promise<SpeakerInsight>;
  summarizeSession: (payload: unknown) => Promise<WholeSessionSummary>;
  onGlobalPaste: (callback: () => void) => () => void;
};
