# TBS November V10 — final spoken line correction

27 October 2026. The CG Nolan Approvals group said at 13:02 that V9 cut off the adviser saying **TBS Brokers**. Nolan acknowledged this at 13:22; the acknowledgement showed Delivered. V10 is a protected correction of that specific defect and supersedes V9 for internal review. All prior work and original client media were preserved.

The V9 adviser picture had **112 frames / 3.733 s** at timeline 22.767 s. Its treated original camera-voice stem lasts **4.02 s**, but V9 trimmed the stem to 3.733 s and faded it from 3.48 s. The V10 recipe [finish_v10.py](tbs-november-advice/finish_v10.py) extends the same upright source and visual treatment to **120 frames / 4.000 s**, and retains the 4.02-second voice with only a 50 ms tail fade. The last 20 ms enters the picture-only logo; music still runs over that logo and its source audio remains muted. The resulting film is **893 frames / 29.767 s** at 30 fps, 1080 × 1920 H.264/AAC. The first 112 frames of the new adviser picture compared to V9 with FFmpeg SSIM **0.998874**, so the correction preserves the previous framing and grade closely.

The V10 MP4 fully decoded. Objective mix measurement was about **−21.4 LUFS integrated, −2.2 dB true peak**. Offline Faster Whisper small transcribed the V9 tail as “Speak to TBS” and V10 as “Speak to TBS Browser”; the latter recognition is imperfect but supports that an additional final word is present. It is **not** an independent human listening verdict. A visual check at 26.65 s shows the adviser still onscreen while the sentence finishes. The exact delivered private MP4 is `C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026\review-package-equipment-v10\2026_11_TBS_VIDEO_01_EQUIPMENT_COVER_V10_REVIEW.mp4`, 17,778,442 bytes, SHA-256 `E747781D0F8FA6D761421ED17A5A32A534E1254F64372B433063B329B0AE0911`. Its matching cover is a renamed copy of the unchanged V9 cover; the proposed caption is unchanged.

## Internal delivery

The exact CG Nolan Approvals group received the V10 MP4 **as a document with only the proposed post caption** at **13:25 SAST**, then the caption-free cover as a separate photo at **13:26**, with WhatsApp **HD 1440 × 2560** selected. A separate 13:26 Nolan note marked V9 superseded. All three displayed **Delivered**. This is not client/public approval. Do not resend V9 or use its cut-off sound.

## Remaining gates

The adviser setup resembles a 20 July TBS public reel; exact picture/audio overlap still needs comparison before client forwarding. Independent full-speed creative listening and physical-phone review, native staff editability and formal approval also remain open. The offline transcript and decode check alone cannot close those gates.
