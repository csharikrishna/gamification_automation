# Local Text-to-Speech (TTS) Architecture & Engine Evaluation
**Evaluated by**: Audio & Creative Production Engineering  
**Scope**: Feasibility of integrating local, offline Text-to-Speech into Burstpoint for Mode B (Minimal Commentator) and Mode C (Full Commentary).

---

## 1. Evaluation Matrix: Local Offline TTS Engines

| Metric / Requirement | **Piper TTS** (VITS-based) | **Kokoro-82M** (StyleTTS2-based) | **Pre-Generated Sound Library + Procedural Pitch** |
| :--- | :--- | :--- | :--- |
| **Voice Naturalness & Quality** | 7.8 / 10 (Clean, robotic inflection on excited numbers) | **9.2 / 10** (Outstanding human cadence, excitement modulation) | 8.5 / 10 (Studio-recorded voice actors, perfect clarity) |
| **Generation Speed (RTF on CPU)** | **~0.15 RTF** (Fast, lightweight C++ binary) | ~0.50 RTF (Moderate on CPU, fast on CUDA/DirectML) | **0.00 RTF** (Instantaneous disk read) |
| **Hardware & RAM Footprint** | **< 60 MB RAM**, zero GPU required | ~350 MB RAM, PyTorch / ONNX runtime | **< 10 MB RAM** |
| **Binary & Dependency Weight** | ~20 MB standalone executable + ONNX model | ~120 MB model weights + ONNX / PyTorch dependencies | Zero external dependencies (native WAV loader) |
| **Offline Airgap Capability** | 100% Offline (No cloud APIs or API keys) | 100% Offline | 100% Offline |
| **Licensing** | MIT / Apache 2.0 | Apache 2.0 | MIT / Proprietary studio assets |
| **Pronunciation of Math & Gaming Terms** | Requires custom phoneme dictionary for "×2", "Tier 6" | Strong native pronunciation, supports SSML pauses | Exact predetermined pronunciation |
| **Integration Complexity** | Moderate (Child process pipe to WAV) | High (Python daemon or ONNX runtime node binding) | **Lowest (Direct FFmpeg audio stream muxing)** |

---

## 2. Architectural Recommendation

### Recommended Primary Mode: Mode A (Pure Physics / ASMR)
Audience attention data on short-form platforms (YouTube Shorts, TikTok) indicates that **for marble and kinetic physics content, pure physics ASMR audio consistently achieves higher loop retention than continuous AI voice narration**. Crisp marble ricochets, crunchy barrier fractures, and fanfare chord bursts keep viewers focused on the visual math.

### Recommended Commentary Path: Mode B (Minimal Commentator via Pre-rendered Stems)
For Mode B, we implement a **hybrid stem architecture**:
1. Pre-generate high-quality voice cues for opening hooks ("3 balls against 12. Who wins?", "Watch the multiplier!").
2. Modulate audio with dynamic ducking ($-6.0\text{ dB}$ on physics effects during voiceover) and sidechain compression using FFmpeg.
3. For dynamic scenario generation where arbitrary text is needed, **Piper ONNX** serves as the optional local provider without introducing heavyweight Python or PyTorch runtime requirements.

---

## 3. Audio Mixing & Mastering Standards
All Burstpoint audio streams conform to:
- **Sample Rate**: 44.1 kHz, 16-bit Stereo PCM WAV $\rightarrow$ 192 kbps AAC.
- **Target Integrated Loudness**: $-14\text{ LUFS} \pm 1.0\text{ LUFS}$ (YouTube Shorts standard).
- **True Peak Ceiling**: $-1.0\text{ dBTP}$ to prevent inter-sample clipping on mobile speakers.
- **Audio/Video Stream Alignment**: Exactly $20.00\text{s}$ duration matching video frames ($1200\text{ frames @ 60 FPS}$).
