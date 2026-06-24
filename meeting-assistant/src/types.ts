export type SpeakerStatus = 'empty' | 'captured' | 'analyzed' | 'response_ready' | 'responded';

export type SourceType = 'manual_paste' | 'clipboard' | 'ocr_text' | 'meeting_transcript' | 'future_asr' | 'image_upload';

export type AIProvider = 'openai_responses' | 'xiaomi_mimo' | 'openai_compatible';

export type GeneratedBy = AIProvider | 'openai' | 'local';

export type KnowledgeType = 'core_experience' | 'morning_speech' | 'response_style' | 'quote';

export type SummaryTemplateType = 'resonance' | 'structure' | 'hybrid';

export type SummaryTemplateMode = 'auto' | SummaryTemplateType;

export type SummaryVersion = {
  id: string;
  label: string;
  source: 'generated' | 'refined';
  templateMode: SummaryTemplateType;
  summary: WholeSessionSummary;
  requirement?: string;
  createdAt: string;
  collapsed?: boolean;
};

export type Theme = {
  id: string;
  name: string;
  core: string;
  day?: number;
  content?: string;
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

export type DailyObservationMaterial = {
  content: string;
};

export type KnowledgeEntry = {
  id: string;
  title: string;
  type: KnowledgeType;
  tags: string[];
  sourceTitle?: string;
  sourceDate?: string;
  relatedCourses?: string[];
  applicableScenes: string;
  summary: string;
  originalExcerpt: string;
  reusableLines: string[];
  speakingBoundary: string;
  avoidDetails: string[];
  createdAt: string;
  updatedAt: string;
};

export type ContentSnippet = {
  id: string;
  sourceType: SourceType;
  text: string;
  createdAt: string;
  imageDataUrl?: string;
  ocrImageDataUrl?: string;
  mimeType?: string;
  fileName?: string;
};

export type TranscriptLine = {
  speakerName: string;
  time: string;
  text: string;
};

export type TranscriptOrganizeResult = {
  entries: TranscriptLine[];
  transcriptText?: string;
};

export type TranscriptWorkspace = {
  ocrSnippets: Array<{
    id: string;
    text: string;
    createdAt: string;
    fileName?: string;
  }>;
  transcriptText: string;
  organizedOcrSnippetIds?: string[];
  updatedAt?: string;
};

export type SpeakerInsight = {
  suggestedSpeakerName?: string;
  strongestPoint: string;
  underlyingPattern: string;
  themeConnection: string;
  stuckType: string;
  seenNeed: string;
  suggestedObserverStory: string;
  storyUseBoundary: string;
  oneMinuteResponse: string;
  deepResponse: string;
  powerfulQuestion: string;
  goldenSentence: string;
  doNotSay: string[];
  generatedBy?: GeneratedBy;
};

export type PolishedSpeakerContent = {
  polishedContent: string;
  generatedBy?: GeneratedBy;
};

export type SpeakerCard = {
  id: string;
  name: string;
  status: SpeakerStatus;
  snippets: ContentSnippet[];
  polishedContent?: string;
  polishedAt?: string;
  insight?: SpeakerInsight;
  actualResponse?: string;
};

export type WholeSessionSummary = {
  templateDecision?: {
    template: SummaryTemplateType;
    templateName: string;
    reason: string;
    sceneSignals: string[];
  };
  courseTheme: string;
  commonTheme: string;
  speakerLessons: Array<{
    speakerName: string;
    lesson: string;
    themeConnection: string;
  }>;
  keyResponse: string;
  structuredSections?: Array<{
    key: string;
    title: string;
    body: string;
  }>;
  sharingSections?: Array<{
    title: string;
    body: string;
  }>;
  unifiedResponseAngle?: string;
  finalSummary?: string;
  goldenSentences: string[];
  oneSentenceSummaries?: string[];
  closingSentence: string;
  missingSpeakers: string[];
  generatedBy?: GeneratedBy;
};

export type ObserverSession = {
  id: string;
  title: string;
  themeId: string;
  observerStance: string;
  dailyObservation: DailyObservationMaterial;
  transcriptWorkspace: TranscriptWorkspace;
  speakers: SpeakerCard[];
  stories: Story[];
  summary?: WholeSessionSummary;
  summaryVersions?: SummaryVersion[];
  summaryOutputCount?: number;
  summaryKnowledgeIds?: string[];
  refinedSummary?: WholeSessionSummary;
  refinedSummaryRequirement?: string;
  excludedSummaryKnowledgeIds?: string[];
  finalSpeechDraft?: string;
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
  readClipboardImage: () => Promise<{ imageDataUrl: string; fileName?: string } | null>;
  writeClipboardText: (text: string) => Promise<boolean>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: { provider: AIProvider; apiKey: string; baseUrl: string; model: string }) => Promise<AppSettings>;
  ocrImage: (imageDataUrl: string, fileName?: string) => Promise<{ text: string }>;
  extractDocumentText: (payload: { fileName: string; dataUrl: string }) => Promise<{ text: string }>;
  polishSpeakerContent: (payload: unknown) => Promise<PolishedSpeakerContent>;
  organizeTranscript: (payload: unknown) => Promise<TranscriptOrganizeResult>;
  analyzeSpeaker: (payload: unknown) => Promise<SpeakerInsight>;
  summarizeSession: (payload: unknown) => Promise<WholeSessionSummary>;
  extractKnowledge: (payload: unknown) => Promise<{ entries: KnowledgeEntry[] }>;
  onGlobalPaste: (callback: () => void) => () => void;
};
