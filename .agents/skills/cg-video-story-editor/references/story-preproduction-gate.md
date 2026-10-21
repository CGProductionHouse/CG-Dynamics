# Story preproduction gate

Complete this gate for **every** new client video. A client name, monthly slot, archive folder, and attractive footage are inputs; they are not yet a story. Do not start assembling a timeline until the one-page brief below has a defensible answer for each question. If a key fact is missing, record the gap and gather the source or revise the concept.

## Evidence before concept

1. Resolve the exact client and month. Read the current client guide, monthly strategy, package, content guideline, recent client corrections, current logo/brand kit, and latest published covers and poster designs (including Canva when that is where the client keeps them). Keep draft strategies distinct from approved instructions.
2. List every post and video available this year for that exact client. Mark **published**, export-only, planned, or unknown. Watch the strongest relevant videos in full. Log opener, person addressed, promise, story turn, proof, CTA, visual and sound choices, and footage already used. Do not treat a file in an export folder as published without publication evidence.
3. Retrieve comparable post results where available: reach, plays, 3-second views or retention, average watch, completion, saves, comments, shares, clicks, and qualified enquiries. Record the platform, observation period, and post ID. If only rankings or reactions are visible, say so. Do not infer that a creative choice caused a metric or invent a benchmark. Distinguish organic from paid and comparable from unrelated posts.
4. Check audience language and service scope against client evidence and the actual adviser/product. Use one primary audience per film. Note what action is realistic after viewing.
5. Sample current videos from that client's industry and a few adjacent high-quality editors. Record the date, source, opening mechanism, proof, pacing, sound structure and outcome evidence if available. Separate an enduring craft principle from a short-lived format; never infer performance from views alone or copy a competitor's claims, footage or soundtrack.

## One-page brief required before editing

Write these in plain language, with source links or local paths:

- **Why this post, why now?** State the actual month/business reason. A calendar date is not itself a reason; avoid fabricated urgency.
- **Who exactly?** One viewer, current situation, what they already believe, what they worry about, and what would feel useful rather than promotional.
- **One job and one measurable action.** Examples: prompt a qualified enquiry with a specific question, help viewers recognise a product distinction, or build trust in a real team. Do not blur awareness, enquiries and sales into one goal.
- **Single sentence message.** What should the viewer understand or do after the video? Remove any phrase that could belong to ten other clients.
- **Three hook candidates.** For each, storyboard the first frame, sound, exact first three seconds, and the reason the target viewer would stop. Reject hooks that only create noise, ask an abstract question, or postpone the subject.
- **Arc.** Define opening tension, development, proof, emotional or practical payoff, and CTA. Each beat must change the viewer's understanding. A list of examples is not an arc.
- **Comparison and hypothesis.** Name the closest relevant prior client video/post and its observed result. Specify what this video changes and which metric would show improvement. When comparable metrics are unavailable, mark the performance hypothesis unproven.
- **Freshness decision.** Name one current industry technique worth testing and why it suits this buyer and brand, plus one popular treatment rejected because it weakens clarity, credibility or product visibility. Record a clean-cut fallback so trend research does not become an effects requirement.
- **Source plan.** Assign every proposed shot a distinct visual role and `visual_cluster` (same action/person/setting/viewpoint). Log original file, in/out, previous use, rights, claims supported, and 9:16 suitability. A different filename does not make repeated coverage visually distinct. No same source clip twice; no recurring visual cluster unless the story explicitly requires a return and that exception is approved.
- **Feasibility gaps.** Say which specific live footage, adviser participation, stock license, copy approval, or contact verification is still needed. Do not fill a narrative gap with vaguely related archive shots.

## Decision gate

Before building, read the brief as the target viewer and answer: “Why would I stop in the first three seconds? What do I learn? Why this client? What should I do next?” If any answer needs the editor to explain it, rewrite the opening or concept. Screen all selected moving footage and compare nearby shots at phone size for perceived repetition. A timeline must not be called a review draft if it fails this gate.

For a machine-checked handoff, save the brief as JSON with the field names in `scripts/preflight_story.py`, then run `python scripts/preflight_story.py story-plan.json`. It rejects absent audience/goals/hooks and reused source or visual-cluster IDs. It cannot determine whether two different files look like the same moment; the moving-cut review remains mandatory.

After publication, compare observed retention and action with the hypothesis. Record what the evidence supports and what remains unknown. Update the case study and source ledger, not a universal style rule, when the lesson is client-specific.
