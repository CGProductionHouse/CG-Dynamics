# Offline narration ducking — bounded6November practice,9November closeout

Advances the existing [brand voice overlay](skills/brand-voice-overlay/SKILL.md), not a new family or finished client film. CA ended the night and authorised shutdown6November at21:59SAST; no experiment continued overnight after that instruction. On9November the resumed goal reconciles the saved experiment, tests the existing prototype and shares its actual failed gates. No expired night schedule is restarted.

## Reusable mechanism

Canonical `voice_overlay.py::ducking_envelope` now accepts optional offline `lookahead` and `hold` seconds. Defaults remain zero and retain the existing causal control. Speech is not moved, attenuated or delayed: only the separate music bed receives the returned envelope. Preview expands each detected active interval earlier; hold extends it after speech. Attack/release smoothing then acts on those intervals. This is not a latency-free live processor. Anticipation cannot repair an opening with no available pre-roll; design the music entrance separately. Hold must preserve deliberate phrase pauses rather than flatten the whole score.

Read the primary [Audacity Auto Duck explanation](https://manual.audacityteam.org/man/auto_duck.html) for control-track separation and pause/fade concepts. This implementation is an independent, bounded RMS-envelope operator, not a reproduction or proof of Audacity native execution. The study uses9dB reduction,25ms attack,200ms release,80ms preview and120ms hold; protected revision changes only hold to200ms. These are experiment values, not brand defaults or a heard mix recommendation.

## Exact source and output evidence

Private `work/overnight/voice-cta-20261106/` contains generation/build/ASR scripts, manifest, actual WAV/AAC/decoded controls, comparison and the owner-stop checkpoint. Installed Microsoft David Desktop is **US engineering speech only**; commercial brand rights, South African accent and production pronunciation are not cleared. No cloud TTS, API/credit, cloning or client voice profile was used. Music is an eight-second excerpt of the previously verified Mixkit1156/The Clique score, source SHA256 `42d90a0ec219b702668db3f41c987e93a09cba6028936d9137a6caf5bf09cd87`; this is private research reuse, not a new client assignment or song recommendation. Do not distribute source music or voice as cleared brand assets.

Four8s/48kHz stereo WAV→AAC→decoded-WAV controls each contain384000 decoded samples: un-ducked negative, causal9dB, anticipated80ms/hold120ms, hold-only200ms revision. Same dry revised speech and score spans are used in every mix. Common headroom scalar0.626874 preserves ratios; plain sum peak capped0.85. Initial RMS-only scaling would clip: assertion stopped before any output and that failure is retained. No limiter was used to hide it.

At the first measured active sample1.130875s, causal gain is−0.19953dB; anticipation reaches−8.40006dB. The envelope chart was actually inspected: short inter-word music rebounds in the causal control disappear with bounded hold, while the long phrase pause still releases. This is measured behavior, not a claim of heard naturalness. Hold120→200ms preserves the first0.8s exactly in raw envelope and decoded AAC controls. Narration ends6.488667s, leaving the8s control tail. No retime or clipped consonant repair is claimed.

## Intelligibility failure changes the next action

Earlier full30s ASR misread the adviser CTA. Six unchanged-configuration local faster-whisper-base inputs were consumed without script hints or retries: old isolated dry take, revised isolated dry take, and four exact decoded mixes. Old isolated wording now transcribes correctly: context-dependent model behavior matters. Revised wording is **not timing-only**: `Ask your adviser. Check which excess applies to your policy.` adds words and a sentence pause. In both dry and every mix ASR reads **excess as access**. All revised semantic keyword checks therefore FAIL. Adviser/advisor is an orthographic variant, not this failed insurance term.

The ducking mechanism passes engineering checks but does not solve pronunciation, establish intelligibility or clear a film. Do not repeat prompts/models to manufacture a green result. Next production step is an actual rights-cleared South African take with a tested terminology list, followed by exact dry/context/mix evidence and appropriate sound review. No South African narrator is selected; no human hearing, artistic approval, phone/native/cross-PC or mastery claim.

## Regression and handover

Thirteen focused UI/voice tests pass, including onset anticipation, no mutation of speech, inter-word hold versus phrase release, protected hold revision, default zero-option identity, empty/silent/boundary signals and invalid inputs. Existing rights/locale/placement guards remain. Four AAC outputs are freshly re-decoded/hash/length checked at closeout; no rerender or ASR retry. This does not expand the qualified music-character reviewer to speech or infer a heard mix.

Native CapCut study was already published separately with its parity/easing failures. Existing53 documented families remain53; this closeout advances one existing voice family and adds no mastery count. MSI must reconcile/install the shared change and independently audition any real voice/music application; publication is not another PC's installation proof. Private source/audio stays outside Git; no client, MSI timeline, storage worker, account, security or scheduler change.
