import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { createDefaultSession, themes } from './data';
import { getObserverAPI } from './observerApi';
import { buildSessionPrompt, buildSpeakerPrompt, createLocalSpeakerInsight, createLocalWholeSummary } from './prompts';
import type { AIProvider, AppSettings, ContentSnippet, ObserverSession, SourceType, SpeakerCard, SpeakerInsight, WholeSessionSummary } from './types';

const STORAGE_KEY = 'morning-observer-session-v1';

const sourceLabels: Record<SourceType, string> = {
  manual_paste: '手动',
  clipboard: '剪贴板',
  ocr_text: 'OCR',
  meeting_transcript: '会议转写',
  future_asr: '语音',
  image_upload: '图片',
};

const statusLabels: Record<SpeakerCard['status'], string> = {
  empty: '待粘贴',
  captured: '已采集',
  analyzed: '已分析',
  response_ready: '回应已备',
  responded: '已回应',
};

const providerPresets: Record<AIProvider, { label: string; keyLabel: string; baseUrl: string; model: string; help: string }> = {
  openai_responses: {
    label: 'OpenAI Responses',
    keyLabel: 'OpenAI API Key',
    baseUrl: '',
    model: 'gpt-4.1-mini',
    help: '适合已有 OpenAI API Key 的情况，使用结构化输出更稳定。',
  },
  xiaomi_mimo: {
    label: '小米 MiMo Token Plan',
    keyLabel: '小米 API Key',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
    help: '适合 tp- 开头的订阅 key；如果是 sk- 开头的按量 key，把 Base URL 改成 https://api.xiaomimimo.com/v1。',
  },
  openai_compatible: {
    label: 'OpenAI 兼容接口',
    keyLabel: 'API Key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    help: '适合其他支持 /chat/completions 的模型服务，Base URL 和模型都可以手填。',
  },
};

const xiaomiTokenPlan = {
  title: 'Lite 月度套餐',
  quota: '4,100,000,000 Credits',
  openAIBaseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  anthropicBaseUrl: 'https://token-plan-cn.xiaomimimo.com/anthropic',
  primaryModel: 'mimo-v2.5-pro',
  models: ['mimo-v2.5-pro', 'mimo-v2.5', 'mimo-v2.5-asr', 'mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-tts'],
};

function loadSession(): ObserverSession {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultSession();
  }

  try {
    return JSON.parse(raw) as ObserverSession;
  } catch {
    return createDefaultSession();
  }
}

function nowLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function compactText(text: string, max = 92) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

function createSnippet(text: string, sourceType: SourceType): ContentSnippet {
  return {
    id: crypto.randomUUID(),
    sourceType,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function createImageSnippet(file: File): Promise<ContentSnippet> {
  const originalDataUrl = await readFileAsDataUrl(file);
  return createImageSnippetFromDataUrl(originalDataUrl, file.name, file.type);
}

async function createImageSnippetFromDataUrl(originalDataUrl: string, fileName = '截图.png', mimeType = 'image/png'): Promise<ContentSnippet> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片读取失败。'));
    img.src = originalDataUrl;
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('图片处理失败。');
  }
  context.drawImage(image, 0, 0, width, height);
  const outputType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(outputType, 0.86);

  return {
    id: crypto.randomUUID(),
    sourceType: 'image_upload',
    text: `已上传图片：${fileName}。请先识别图片中的会议转写、字幕、聊天或截图文字，再结合本期主题分析。`,
    createdAt: new Date().toISOString(),
    imageDataUrl: dataUrl,
    mimeType: dataUrl.slice(5, dataUrl.indexOf(';')) || outputType,
    fileName,
  };
}

function getCurrentSpeaker(session: ObserverSession, selectedSpeakerId: string) {
  return session.speakers.find((speaker) => speaker.id === selectedSpeakerId) || session.speakers[0];
}

export default function App() {
  const [session, setSession] = useState<ObserverSession>(() => loadSession());
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(() => loadSession().speakers[0]?.id || '');
  const [draftText, setDraftText] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('clipboard');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    provider: 'openai_responses',
    apiKey: '',
    hasApiKey: false,
    baseUrl: '',
    model: 'gpt-4.1-mini',
  });
  const [providerInput, setProviderInput] = useState<AIProvider>('openai_responses');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [modelInput, setModelInput] = useState('gpt-4.1-mini');
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const currentSpeaker = getCurrentSpeaker(session, selectedSpeakerId);
  const selectedTheme = useMemo(() => themes.find((theme) => theme.id === session.themeId) || themes[0], [session.themeId]);
  const analyzedCount = session.speakers.filter((speaker) => speaker.insight).length;
  const capturedCount = session.speakers.filter((speaker) => speaker.snippets.length > 0).length;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session.speakers.some((speaker) => speaker.id === selectedSpeakerId)) {
      setSelectedSpeakerId(session.speakers[0]?.id || '');
    }
  }, [selectedSpeakerId, session.speakers]);

  useEffect(() => {
    getObserverAPI().loadSettings().then((loaded) => {
      setSettings(loaded);
      setProviderInput(loaded.provider || 'openai_responses');
      setBaseUrlInput(loaded.baseUrl || providerPresets[loaded.provider || 'openai_responses'].baseUrl);
      setModelInput(loaded.model || 'gpt-4.1-mini');
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    return getObserverAPI().onGlobalPaste(() => {
      void pasteFromClipboard();
    });
  });

  function updateSession(updater: (current: ObserverSession) => ObserverSession) {
    setSession((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
  }

  function updateSpeaker(speakerId: string, updater: (speaker: SpeakerCard) => SpeakerCard) {
    updateSession((current) => ({
      ...current,
      speakers: current.speakers.map((speaker) => (speaker.id === speakerId ? updater(speaker) : speaker)),
    }));
  }

  function appendSnippet(text: string, snippetSource: SourceType) {
    const trimmed = text.trim();
    if (!trimmed || !currentSpeaker) {
      return;
    }

    const snippet = createSnippet(trimmed, snippetSource);
    updateSpeaker(currentSpeaker.id, (speaker) => ({
      ...speaker,
      status: speaker.status === 'empty' ? 'captured' : speaker.status,
      snippets: [...speaker.snippets, snippet],
    }));
    setDraftText('');
    setNotice(`已加入 ${currentSpeaker.name}`);
  }

  async function pasteFromClipboard() {
    const clipboardImage = await getObserverAPI().readClipboardImage().catch(() => null);
    if (clipboardImage?.imageDataUrl) {
      await appendImageSnippets([
        await createImageSnippetFromDataUrl(clipboardImage.imageDataUrl, clipboardImage.fileName || '剪贴板截图.png'),
      ], '已从剪贴板截图加入');
      return;
    }

    const text = await getObserverAPI().readClipboardText();
    appendSnippet(text, 'clipboard');
  }

  async function pasteImageFromClipboard() {
    const clipboardImage = await getObserverAPI().readClipboardImage().catch(() => null);
    if (!clipboardImage?.imageDataUrl) {
      setNotice('剪贴板里没有截图。也可以点进输入框后直接 Cmd+V。');
      return;
    }
    await appendImageSnippets([
      await createImageSnippetFromDataUrl(clipboardImage.imageDataUrl, clipboardImage.fileName || '剪贴板截图.png'),
    ], '已从剪贴板截图加入');
  }

  function handleDraftPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void (async () => {
      const snippets = await Promise.all(files.map((file) => createImageSnippet(file)));
      await appendImageSnippets(snippets, '已从粘贴截图加入');
    })();
  }

  async function appendImageSnippets(snippets: ContentSnippet[], successPrefix = '已上传') {
    if (!currentSpeaker || snippets.length === 0) {
      return;
    }

    setBusy('image');
    try {
      const ocrSnippets = await Promise.all(
        snippets.map(async (snippet) => {
          try {
            const result = await getObserverAPI().ocrImage(snippet.imageDataUrl || '', snippet.fileName);
            const ocrText = result.text.trim();
            if (ocrText) {
              return {
                ...snippet,
                sourceType: 'ocr_text' as SourceType,
                text: `图片 OCR 识别结果（${snippet.fileName || '截图'}）：\n${ocrText}`,
              };
            }
          } catch {
            return snippet;
          }
          return snippet;
        })
      );
      updateSpeaker(currentSpeaker.id, (speaker) => ({
        ...speaker,
        status: speaker.status === 'empty' ? 'captured' : speaker.status,
        snippets: [...speaker.snippets, ...ocrSnippets],
      }));
      setNotice(`${successPrefix} ${snippets.length} 张图片到 ${currentSpeaker.name}。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '图片处理失败。');
    } finally {
      setBusy(null);
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!files || !currentSpeaker) {
      return;
    }

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setNotice('请选择图片文件。');
      return;
    }

    setBusy('image');
    try {
      const snippets = await Promise.all(imageFiles.map((file) => createImageSnippet(file)));
      await appendImageSnippets(snippets, '已上传');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '图片上传失败。');
    } finally {
      setBusy(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  }

  function addSpeaker() {
    const speaker: SpeakerCard = {
      id: crypto.randomUUID(),
      name: `发言人 ${session.speakers.length + 1}`,
      status: 'empty',
      snippets: [],
    };
    updateSession((current) => ({
      ...current,
      speakers: [...current.speakers, speaker],
    }));
    setSelectedSpeakerId(speaker.id);
  }

  function renameSpeaker(speakerId: string, name: string) {
    updateSpeaker(speakerId, (speaker) => ({ ...speaker, name }));
  }

  function moveSpeaker(speakerId: string, direction: -1 | 1) {
    updateSession((current) => {
      const index = current.speakers.findIndex((speaker) => speaker.id === speakerId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.speakers.length) {
        return current;
      }

      const speakers = [...current.speakers];
      const [speaker] = speakers.splice(index, 1);
      speakers.splice(targetIndex, 0, speaker);
      return { ...current, speakers };
    });
  }

  function deleteSnippet(snippetId: string) {
    updateSpeaker(currentSpeaker.id, (speaker) => {
      const snippets = speaker.snippets.filter((snippet) => snippet.id !== snippetId);
      return {
        ...speaker,
        snippets,
        status: snippets.length === 0 ? 'empty' : speaker.status,
      };
    });
  }

  function markResponded() {
    updateSpeaker(currentSpeaker.id, (speaker) => ({
      ...speaker,
      status: 'responded',
    }));
  }

  function updateActualResponse(value: string) {
    updateSpeaker(currentSpeaker.id, (speaker) => ({
      ...speaker,
      actualResponse: value,
    }));
  }

  async function copyText(text: string, label: string) {
    if (!text) {
      return;
    }
    await getObserverAPI().writeClipboardText(text);
    setNotice(`已复制：${label}`);
  }

  async function analyzeSpeaker() {
    if (!currentSpeaker || currentSpeaker.snippets.length === 0) {
      setNotice('先给当前发言人粘贴内容。');
      return;
    }

    setBusy('analyze');
    setNotice('');
    try {
      let insight: SpeakerInsight;
      if (settings.hasApiKey) {
        const payload = buildSpeakerPrompt(session, selectedTheme, currentSpeaker);
        insight = await getObserverAPI().analyzeSpeaker(payload);
        insight.generatedBy = settings.provider;
      } else {
        insight = createLocalSpeakerInsight(currentSpeaker, selectedTheme);
      }

      updateSpeaker(currentSpeaker.id, (speaker) => ({
        ...speaker,
        insight,
        status: 'response_ready',
      }));
      setNotice(settings.hasApiKey ? '已生成 AI 单人洞察。' : '已生成本地演练稿；设置 API Key 后可获得真实 AI 分析。');
    } catch (error) {
      const fallback = createLocalSpeakerInsight(currentSpeaker, selectedTheme);
      updateSpeaker(currentSpeaker.id, (speaker) => ({
        ...speaker,
        insight: fallback,
        status: 'response_ready',
      }));
      setNotice(`AI 请求失败，已用本地演练稿代替：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBusy(null);
    }
  }

  async function summarizeSession() {
    setBusy('summary');
    setNotice('');
    try {
      let summary: WholeSessionSummary;
      if (settings.hasApiKey) {
        const payload = buildSessionPrompt(session, selectedTheme);
        summary = await getObserverAPI().summarizeSession(payload);
        summary.generatedBy = settings.provider;
      } else {
        summary = createLocalWholeSummary(session, selectedTheme);
      }

      updateSession((current) => ({
        ...current,
        summary,
      }));
      setNotice(settings.hasApiKey ? '已生成全场总结。' : '已生成本地全场草稿；设置 API Key 后可获得真实 AI 总结。');
    } catch (error) {
      const summary = createLocalWholeSummary(session, selectedTheme);
      updateSession((current) => ({ ...current, summary }));
      setNotice(`AI 请求失败，已用本地全场草稿代替：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBusy(null);
    }
  }

  function changeProvider(nextProvider: AIProvider) {
    const currentPreset = providerPresets[providerInput];
    const nextPreset = providerPresets[nextProvider];
    setProviderInput(nextProvider);

    if (!modelInput.trim() || modelInput.trim() === currentPreset.model) {
      setModelInput(nextPreset.model);
    }
    if (!baseUrlInput.trim() || baseUrlInput.trim() === currentPreset.baseUrl) {
      setBaseUrlInput(nextPreset.baseUrl);
    }
  }

  function applyXiaomiTokenPlan() {
    setProviderInput('xiaomi_mimo');
    setBaseUrlInput(xiaomiTokenPlan.openAIBaseUrl);
    setModelInput(xiaomiTokenPlan.primaryModel);
    setNotice('已套用小米 Token Plan 配置。');
  }

  async function saveSettings() {
    const saved = await getObserverAPI().saveSettings({
      provider: providerInput,
      apiKey: apiKeyInput.trim() || '__KEEP__',
      baseUrl: baseUrlInput.trim(),
      model: modelInput.trim() || providerPresets[providerInput].model,
    });
    setSettings(saved);
    setProviderInput(saved.provider);
    setBaseUrlInput(saved.baseUrl);
    setModelInput(saved.model);
    setApiKeyInput('');
    setSettingsOpen(false);
    setNotice(saved.hasApiKey ? `设置已保存：${providerPresets[saved.provider].label}。` : '模型已保存，API Key 仍为空。');
  }

  function buildMarkdownReview() {
    const summary = session.summary;
    const lines = [
      `# ${session.title}`,
      '',
      `- 本期主题：${selectedTheme.name}`,
      `- 主题核心：${selectedTheme.core}`,
      `- 观察者立场：${session.observerStance}`,
      `- 更新时间：${new Date(session.updatedAt).toLocaleString('zh-CN')}`,
      '',
      '## 发言人复盘',
      '',
    ];

    for (const speaker of session.speakers) {
      lines.push(`### ${speaker.name}`);
      lines.push('');
      lines.push(`- 状态：${statusLabels[speaker.status]}`);
      lines.push(`- 内容片段：${speaker.snippets.length} 段`);
      lines.push('');

      if (speaker.snippets.length > 0) {
        lines.push('#### 原始内容');
        lines.push('');
        speaker.snippets.forEach((snippet, index) => {
          lines.push(`**片段 ${index + 1}（${sourceLabels[snippet.sourceType]}，${nowLabel(snippet.createdAt)}）**`);
          lines.push('');
          lines.push(snippet.text);
          lines.push('');
        });
      }

      if (speaker.insight) {
        lines.push('#### AI 抓点');
        lines.push('');
        lines.push(`- 最值得抓的点：${speaker.insight.strongestPoint}`);
        lines.push(`- 背后的本质：${speaker.insight.underlyingPattern}`);
        lines.push(`- 主题连接：${speaker.insight.themeConnection}`);
        lines.push(`- 卡点分类：${speaker.insight.stuckType}`);
        lines.push(`- 需要被看见：${speaker.insight.seenNeed}`);
        lines.push(`- 适合关联经历：${speaker.insight.suggestedObserverStory}`);
        lines.push('');
        lines.push('#### 现场回应稿');
        lines.push('');
        lines.push(speaker.insight.oneMinuteResponse);
        lines.push('');
        lines.push(`追问：${speaker.insight.powerfulQuestion}`);
        lines.push('');
        lines.push('#### 不要说的话');
        lines.push('');
        speaker.insight.doNotSay.forEach((item) => lines.push(`- ${item}`));
        lines.push('');
      }

      if (speaker.actualResponse?.trim()) {
        lines.push('#### 我的实际回应');
        lines.push('');
        lines.push(speaker.actualResponse.trim());
        lines.push('');
      }
    }

    if (summary) {
      lines.push('## 全场统一洞察');
      lines.push('');
      lines.push(`### 共同主题`);
      lines.push(summary.commonTheme);
      lines.push('');
      lines.push('### 每人课题');
      lines.push('');
      summary.speakerLessons.forEach((item) => {
        lines.push(`- **${item.speakerName}**：${item.lesson}（${item.themeConnection}）`);
      });
      lines.push('');
      lines.push('### 统一回应角度');
      lines.push(summary.unifiedResponseAngle);
      lines.push('');
      lines.push('### 最终总结');
      lines.push(summary.finalSummary);
      lines.push('');
      lines.push('### 金句');
      summary.goldenSentences.forEach((sentence) => lines.push(`- ${sentence}`));
      lines.push('');
      lines.push(`### 收束`);
      lines.push(summary.closingSentence);
      lines.push('');
    }

    return lines.join('\n');
  }

  async function copyMarkdownReview() {
    await copyText(buildMarkdownReview(), 'Markdown 复盘');
  }

  function downloadMarkdownReview() {
    const markdown = buildMarkdownReview();
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = session.title.replace(/[\\/:*?"<>|]/g, '-');
    link.href = url;
    link.download = `${safeTitle || '晨读观察台复盘'}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Markdown 复盘已下载。');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="title-group">
          <input
            className="session-title"
            value={session.title}
            onChange={(event) => updateSession((current) => ({ ...current, title: event.target.value }))}
          />
          <span className="session-meta">
            已采集 {capturedCount}/{session.speakers.length} · 已分析 {analyzedCount}/{session.speakers.length}
          </span>
        </div>

        <label className="theme-control">
          <span>本期主题</span>
          <select value={session.themeId} onChange={(event) => updateSession((current) => ({ ...current, themeId: event.target.value }))}>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </label>

        <button className="plain-button" onClick={() => setSettingsOpen(true)}>
          设置
        </button>
      </header>

      <section className="theme-strip">
        <strong>{selectedTheme.name}</strong>
        <span>{selectedTheme.core}</span>
        <small>
          {settings.hasApiKey
            ? `${providerPresets[settings.provider].label} · ${settings.model}`
            : '当前为本地演练稿模式'}
        </small>
      </section>

      <section className="workspace">
        <aside className="speaker-list" aria-label="发言人列表">
          <div className="panel-heading">
            <h2>发言人</h2>
            <button className="icon-button" onClick={addSpeaker} title="新增发言人">
              +
            </button>
          </div>

          <div className="speaker-items">
            {session.speakers.map((speaker, index) => (
              <div
                key={speaker.id}
                className={`speaker-item ${speaker.id === currentSpeaker?.id ? 'active' : ''}`}
              >
                <button className="speaker-select" onClick={() => setSelectedSpeakerId(speaker.id)}>
                  <span className="speaker-name">{speaker.name}</span>
                  <span className={`status-badge status-${speaker.status}`}>{statusLabels[speaker.status]}</span>
                  <span className="speaker-stats">{speaker.snippets.length} 段内容</span>
                </button>
                <div className="speaker-order">
                  <button title="上移" disabled={index === 0} onClick={() => moveSpeaker(speaker.id, -1)}>
                    ↑
                  </button>
                  <button title="下移" disabled={index === session.speakers.length - 1} onClick={() => moveSpeaker(speaker.id, 1)}>
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="content-panel" aria-label="当前发言人内容">
          <div className="panel-heading split">
            <div>
              <input
                className="speaker-title-input"
                value={currentSpeaker?.name || ''}
                onChange={(event) => renameSpeaker(currentSpeaker.id, event.target.value)}
              />
              <p>可以多次粘贴，系统会按此人的全部内容做分析。桌面版可用 Cmd+Shift+V 直接加入当前发言人。</p>
            </div>
            <button className="primary-button" onClick={pasteFromClipboard}>
              粘贴剪贴板
            </button>
          </div>

          <div className="paste-box">
            <div className="paste-toolbar">
              <label>
                来源
                <select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)}>
                  {Object.entries(sourceLabels).filter(([value]) => value !== 'image_upload').map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="paste-actions">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => void uploadImages(event.target.files)}
                />
                <button className="plain-button" disabled={busy === 'image'} onClick={() => imageInputRef.current?.click()}>
                  {busy === 'image' ? '上传中...' : '上传图片'}
                </button>
                <button className="plain-button" disabled={busy === 'image'} onClick={() => void pasteImageFromClipboard()}>
                  粘贴截图
                </button>
                <button className="plain-button" onClick={() => appendSnippet(draftText, sourceType)}>
                  加入当前发言人
                </button>
              </div>
            </div>
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onPaste={handleDraftPaste}
              placeholder="粘贴腾讯会议转写、截图，或你的现场速记..."
            />
          </div>

          <div className="snippet-list">
            <div className="subheading">
              <h3>内容片段</h3>
              <button className="analysis-button" disabled={busy === 'analyze'} onClick={analyzeSpeaker}>
                {busy === 'analyze' ? '分析中...' : '分析这个人'}
              </button>
            </div>

            {currentSpeaker?.snippets.length === 0 ? (
              <div className="empty-state">还没有内容。现场可以先粘速记，后面再补完整转写。</div>
            ) : (
              currentSpeaker.snippets.map((snippet) => (
                <article key={snippet.id} className="snippet-item">
                  <div className="snippet-meta">
                    <span>{sourceLabels[snippet.sourceType]}</span>
                    {snippet.fileName ? <span>{snippet.fileName}</span> : null}
                    <span>{nowLabel(snippet.createdAt)}</span>
                    <button onClick={() => deleteSnippet(snippet.id)}>删除</button>
                  </div>
                  {snippet.imageDataUrl ? <img className="snippet-image" src={snippet.imageDataUrl} alt={snippet.fileName || '上传图片'} /> : null}
                  <p>{compactText(snippet.text, 260)}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="response-panel" aria-label="现场回应">
          <div className="panel-heading">
            <h2>现场回应</h2>
            <button className="plain-button" onClick={markResponded} disabled={!currentSpeaker?.insight}>
              标记已回应
            </button>
          </div>

          {!currentSpeaker?.insight ? (
            <div className="empty-state">分析当前发言人后，这里会出现回应入口。</div>
          ) : (
            <InsightView insight={currentSpeaker.insight} onCopy={copyText} />
          )}

          {currentSpeaker?.insight ? (
            <section className="actual-response">
              <h3>我的实际回应</h3>
              <textarea
                value={currentSpeaker.actualResponse || ''}
                onChange={(event) => updateActualResponse(event.target.value)}
                placeholder="会后补上你现场实际说了什么，方便复盘沉淀..."
              />
            </section>
          ) : null}
        </aside>
      </section>

      <section className="summary-panel">
        <div className="panel-heading split">
          <div>
            <h2>全场统一洞察</h2>
            <p>可以中途生成草稿，未分析的人会被提醒。</p>
          </div>
          <div className="summary-actions">
            <button className="plain-button" onClick={copyMarkdownReview}>
              复制复盘 Markdown
            </button>
            <button className="plain-button" onClick={downloadMarkdownReview}>
              下载 Markdown
            </button>
            <button className="primary-button" disabled={busy === 'summary'} onClick={summarizeSession}>
              {busy === 'summary' ? '合并中...' : '生成全场总结'}
            </button>
          </div>
        </div>

        {session.summary ? <SummaryView summary={session.summary} onCopy={copyText} /> : <div className="empty-state">等至少一位发言人分析后生成全场草稿。</div>}
      </section>

      {notice ? <div className="notice">{notice}</div> : null}

      {settingsOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="settings-modal">
            <div className="panel-heading split">
              <div>
                <h2>AI 设置</h2>
                <p>API Key 保存在本机应用数据目录。留空会保留已有 Key。</p>
              </div>
              <button className="plain-button" onClick={() => setSettingsOpen(false)}>
                关闭
              </button>
            </div>
            <label className="field">
              <span>模型服务</span>
              <select value={providerInput} onChange={(event) => changeProvider(event.target.value as AIProvider)}>
                {(Object.keys(providerPresets) as AIProvider[]).map((provider) => (
                  <option key={provider} value={provider}>
                    {providerPresets[provider].label}
                  </option>
                ))}
              </select>
              <small>{providerPresets[providerInput].help}</small>
            </label>
            {providerInput === 'xiaomi_mimo' ? (
              <section className="mimo-plan-panel">
                <div className="mimo-plan-head">
                  <div>
                    <span className="mimo-kicker">Token Plan</span>
                    <h3>{xiaomiTokenPlan.title}</h3>
                  </div>
                  <button className="plain-button" onClick={applyXiaomiTokenPlan}>
                    套用配置
                  </button>
                </div>
                <div className="mimo-status-grid">
                  <div>
                    <span>API Key</span>
                    <strong>{settings.hasApiKey ? '已保存' : '未保存'}</strong>
                  </div>
                  <div>
                    <span>额度</span>
                    <strong>{xiaomiTokenPlan.quota}</strong>
                  </div>
                  <div>
                    <span>推荐模型</span>
                    <strong>{xiaomiTokenPlan.primaryModel}</strong>
                  </div>
                </div>
                <div className="mimo-url-list">
                  <div className="mimo-url-row">
                    <span>OpenAI Base URL</span>
                    <code>{xiaomiTokenPlan.openAIBaseUrl}</code>
                    <button onClick={() => void copyText(xiaomiTokenPlan.openAIBaseUrl, '小米 OpenAI Base URL')}>复制</button>
                  </div>
                  <div className="mimo-url-row muted">
                    <span>Anthropic Base URL</span>
                    <code>{xiaomiTokenPlan.anthropicBaseUrl}</code>
                    <button onClick={() => void copyText(xiaomiTokenPlan.anthropicBaseUrl, '小米 Anthropic Base URL')}>复制</button>
                  </div>
                </div>
                <div className="mimo-model-list">
                  {xiaomiTokenPlan.models.map((model) => (
                    <button key={model} className={modelInput === model ? 'active' : ''} onClick={() => setModelInput(model)}>
                      {model}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <label className="field">
              <span>{providerPresets[providerInput].keyLabel}</span>
              <input
                type="password"
                value={apiKeyInput}
                placeholder={settings.hasApiKey ? '已保存，留空不变' : providerInput === 'xiaomi_mimo' ? '粘贴小米平台的 API Key' : 'sk-...'}
                onChange={(event) => setApiKeyInput(event.target.value)}
              />
              <small>切换模型服务时，请粘贴对应平台的 Key；留空会保留当前已保存的 Key。</small>
            </label>
            {providerInput !== 'openai_responses' ? (
              <label className="field">
                <span>Base URL</span>
                <input value={baseUrlInput} onChange={(event) => setBaseUrlInput(event.target.value)} />
              </label>
            ) : null}
            <label className="field">
              <span>模型</span>
              <input value={modelInput} onChange={(event) => setModelInput(event.target.value)} />
            </label>
            <button className="primary-button full-width" onClick={saveSettings}>
              保存设置
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function InsightView({ insight, onCopy }: { insight: SpeakerInsight; onCopy: (text: string, label: string) => void }) {
  return (
    <div className="insight-stack">
      <KeyValue title="最值得抓的点" body={insight.strongestPoint} />
      <KeyValue title="背后的本质" body={insight.underlyingPattern} />
      <KeyValue title="主题连接" body={insight.themeConnection} />
      <KeyValue title="卡点分类" body={insight.stuckType} />
      <KeyValue title="需要被看见" body={insight.seenNeed} />
      <KeyValue title="适合关联的经历" body={`${insight.suggestedObserverStory}\n${insight.storyUseBoundary}`} />

      <ResponseBlock title="20 秒回应" body={insight.twentySecondResponse} onCopy={() => onCopy(insight.twentySecondResponse, '20 秒回应')} />
      <ResponseBlock title="1 分钟回应" body={insight.oneMinuteResponse} onCopy={() => onCopy(insight.oneMinuteResponse, '1 分钟回应')} />
      <ResponseBlock title="有力量的追问" body={insight.powerfulQuestion} onCopy={() => onCopy(insight.powerfulQuestion, '追问')} />

      <div className="warning-box">
        <h3>不要说</h3>
        <ul>
          {insight.doNotSay.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SummaryView({ summary, onCopy }: { summary: WholeSessionSummary; onCopy: (text: string, label: string) => void }) {
  const copyPayload = [
    `共同主题：${summary.commonTheme}`,
    '',
    '每人课题：',
    ...summary.speakerLessons.map((item) => `- ${item.speakerName}：${item.lesson}（${item.themeConnection}）`),
    '',
    `统一回应角度：${summary.unifiedResponseAngle}`,
    '',
    summary.finalSummary,
    '',
    '金句：',
    ...summary.goldenSentences.map((sentence) => `- ${sentence}`),
    '',
    `收束：${summary.closingSentence}`,
  ].join('\n');

  return (
    <div className="summary-grid">
      <KeyValue title="共同主题" body={summary.commonTheme} />
      <KeyValue title="统一回应角度" body={summary.unifiedResponseAngle} />
      <div className="summary-lessons">
        <h3>每人课题</h3>
        {summary.speakerLessons.length === 0 ? (
          <p>还没有已分析的发言人。</p>
        ) : (
          summary.speakerLessons.map((item) => (
            <p key={item.speakerName}>
              <strong>{item.speakerName}</strong>：{item.lesson}
            </p>
          ))
        )}
      </div>
      <ResponseBlock title="最终总结" body={summary.finalSummary} onCopy={() => onCopy(copyPayload, '全场总结')} />
      {summary.missingSpeakers.length > 0 ? <div className="missing-warning">未分析：{summary.missingSpeakers.join('、')}</div> : null}
    </div>
  );
}

function KeyValue({ title, body }: { title: string; body: string }) {
  return (
    <section className="kv-block">
      <h3>{title}</h3>
      <p>{body}</p>
    </section>
  );
}

function ResponseBlock({ title, body, onCopy }: { title: string; body: string; onCopy: () => void }) {
  return (
    <section className="response-block">
      <div className="response-title">
        <h3>{title}</h3>
        <button onClick={onCopy}>复制</button>
      </div>
      <p>{body}</p>
    </section>
  );
}
