# 输入参数

必需：剧本文件及图片清单。可选：角色表、参考风格、参考成片、配乐、旁白及每个角色的声纹。角色出现但无台词时不要求声纹。

`brief.json` 示例（路径替换成实际绝对路径）：

```json
{
  "title": "结营影像",
  "script": {"path": "/absolute/script.docx", "mode": "verbatim"},
  "characters": [
    {"id": "lion", "name": "狮子", "aliases": [], "photos": ["/absolute/lion.png"],
     "voice": {"kind": "reference", "reference_audio": "/absolute/lion.wav", "reference_text": "音频中实际说出的文字", "style": "温暖、自然、清晰", "engine": "auto"}},
    {"id": "lion-ai", "name": "狮子 AI 分身", "photos": [],
     "voice": {"kind": "reuse", "character_id": "lion", "style": "温润、松弛、有祝福感"}},
    {"id": "member-a", "name": "书友甲", "photos": ["/absolute/member.png"],
     "voice": {"kind": "stock", "voice_id": "实际提供商的声线 ID", "style": "明亮自然"}}
  ],
  "narrator": {"character_id": "lion-ai"},
  "video": {"aspect_ratio": "16:9", "width": 1920, "height": 1080, "fps": 30},
  "workflow": {"stage": "sample", "sample_seconds": 45},
  "output_dir": "/absolute/output"
}
```

声纹是可选参数：`voice` 缺省或为 null 表示尚未指定，不能解释为静音。`reference_text` 可空；引擎需要时从参考音频识别并核对。原声音频过长、噪声重或多人混说时，生成单人干净参考片段并记录取样范围，保留原文件。

`reuse` 链必须可解析且无环；角色 ID 不重复。所有台词要对应稳定角色 ID，不用文件顺序猜说话人。只配置声音风格不等于配置声纹；声纹相似度也不等于内容正确。

只有用户明确要求模拟嘴型时才进入数字人口型工作流，需要另测质量、时间和可用服务。普通照片旁白默认不做假嘴型。

示例调用：
“用 $photo-script-video 做结营视频。图片在……，剧本是……；狮子用……wav，林娜用……wav，其他角色用公共声线。全文保留，先给45秒样片。”
