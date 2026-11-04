"""Release-contract fixtures only: these tests never establish actual listening."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import audio_review as audio
from local_audio_evidence import character_qualification


class ReviewContract(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="nolan-audio-gate-test-")
        self.root = Path(self.temp.name).resolve()
        assert self.root.parent == Path(tempfile.gettempdir()).resolve()
        assert self.root.name.startswith("nolan-audio-gate-test-")
        self.video = self.root / "fixture.mp4"
        self.mix = self.root / "fixture.mp3"
        self.response = self.root / "fixture-feedback.txt"
        for path in (self.video, self.mix, self.response):
            path.write_text("TEST FIXTURE ONLY; no real media, person or listening verdict.")
        self.kit = self.root / "kit"
        self.kit.mkdir()
        latest = self.kit / "LATEST-EDIT.md"
        latest.write_text("TEST FIXTURE context")
        self.packet = {"video": str(self.video), "video_sha256": audio.digest(self.video),
                       "audio": str(self.mix), "audio_sha256": audio.digest(self.mix),
                       "context": {"client_kit": str(self.kit), "files": [{"path": str(latest), "sha256": audio.digest(latest)}]},
                       "signal": {"failures": []}}
        self.review = {"review_method": "local_human", "audio_sha256": audio.digest(self.mix),
                       "verdict": "no_blocking_issue", "reviewed_at": "2026-01-01T12:00:00Z", "editor": "TEST FIXTURE",
                       "response_path": str(self.response), "response_sha256": audio.digest(self.response),
                       "checks": {area: {"status": "pass", "evidence": "TEST FIXTURE only"} for area in audio.AREAS},
                       "findings": [], "human_listening": {"status": "recorded", "listener": "TEST FIXTURE; not a real listener",
                           "method": "TEST FIXTURE method", "feedback_source": "TEST FIXTURE transcript",
                           "complete_export": True, "normal_speed": True, "video_sha256": audio.digest(self.video)}}

    def tearDown(self):
        assert self.root.parent == Path(tempfile.gettempdir()).resolve()
        assert self.root.name.startswith("nolan-audio-gate-test-")
        self.temp.cleanup()

    def check_review(self, review=None):
        packet, record = self.root / "packet.json", self.root / "review.json"
        packet.write_text(json.dumps(self.packet))
        record.write_text(json.dumps(self.review if review is None else review))
        return audio.gate(packet, record)

    def test_complete_human_metadata_needs_no_invented_model(self):
        result = self.check_review()
        self.assertEqual(result["status"], "AUDIO_CHECKED_FOR_OWNER_REVIEW")
        self.assertFalse(result["client_or_publication_approval"])

    def test_each_actual_listener_field_is_required(self):
        for key in ("listener", "method", "feedback_source", "status", "complete_export", "normal_speed", "video_sha256"):
            with self.subTest(key=key):
                review = copy.deepcopy(self.review)
                del review["human_listening"][key]
                self.assertEqual(self.check_review(review)["status"], "BLOCKED")

    def test_changed_export_and_changed_feedback_are_blocked(self):
        self.video.write_text("changed export")
        self.assertEqual(self.check_review()["status"], "BLOCKED")
        self.packet["video_sha256"] = audio.digest(self.video)
        self.review["human_listening"]["video_sha256"] = self.packet["video_sha256"]
        self.response.write_text("changed original feedback")
        self.assertEqual(self.check_review()["status"], "BLOCKED")

    def test_context_change_is_not_waived_for_human_route(self):
        (self.kit / "LATEST-EDIT.md").write_text("new feedback")
        self.assertEqual(self.check_review()["status"], "BLOCKED")

    def test_partial_checks_findings_and_technical_failures_stay_blocked(self):
        review = copy.deepcopy(self.review)
        review["checks"]["mood"]["status"] = "pending"
        self.assertEqual(self.check_review(review)["status"], "BLOCKED")
        review = copy.deepcopy(self.review)
        review["findings"] = [{"observation": "unresolved fault"}]
        self.assertEqual(self.check_review(review)["status"], "BLOCKED")
        self.packet["signal"]["failures"] = ["Unexplained silence"]
        self.assertEqual(self.check_review()["status"], "BLOCKED")

    def test_legacy_model_records_and_failed_attachment(self):
        review = copy.deepcopy(self.review)
        del review["review_method"]
        review["model"] = "TEST FIXTURE model"
        review["audio_received"] = True
        review["human_listening"] = "not_recorded"
        self.assertEqual(self.check_review(review)["status"], "BLOCKED")
        review = self.model_fixture()
        self.assertEqual(self.check_review(review)["status"], "AUDIO_CHECKED_FOR_OWNER_REVIEW")
        review["audio_received"] = False
        self.assertEqual(self.check_review(review)["status"], "BLOCKED")

    def model_fixture(self):
        review = copy.deepcopy(self.review)
        review.update(review_method="model", model="TEST FIXTURE pipeline version1", audio_received=True,
                      human_listening="not_recorded")
        self.declaration = self.root / "calibration-declaration.json"
        self.result = self.root / "calibration-result.json"
        input_binding = {"path": str(self.mix), "sha256": audio.digest(self.mix)}
        raw_binding = {"path": str(self.response), "sha256": audio.digest(self.response)}
        self.declared = {"reviewer": review["model"], "required_controls": [
            {"id": "original-fixture", "held_out": False, "input": input_binding, "areas": list(audio.AREAS)},
            {"id": "heldout-fixture", "held_out": True, "input": input_binding, "areas": list(audio.AREAS)}]}
        self.observed = {"reviewer": review["model"], "status": "passed", "observations": [
            {"id": key, "passed": True, "raw_observation": raw_binding} for key in ("original-fixture", "heldout-fixture")]}
        self.declaration.write_text(json.dumps(self.declared));self.result.write_text(json.dumps(self.observed))
        review["qualification"] = {"declaration": {"path": str(self.declaration), "sha256": audio.digest(self.declaration)},
                                   "result": {"path": str(self.result), "sha256": audio.digest(self.result)}}
        return review

    def test_failed_wrong_identity_and_missing_controls_block_model(self):
        for mutation in ("failed", "identity", "omitted", "unpassed", "duplicate"):
            with self.subTest(mutation=mutation):
                review = self.model_fixture()
                if mutation == "failed":self.observed["status"] = "failed"
                if mutation == "identity":self.observed["reviewer"] = "another model"
                if mutation == "omitted":self.observed["observations"].pop()
                if mutation == "unpassed":self.observed["observations"][0]["passed"] = False
                if mutation == "duplicate":self.observed["observations"][1]["id"] = "original-fixture"
                self.result.write_text(json.dumps(self.observed))
                review["qualification"]["result"]["sha256"] = audio.digest(self.result)
                self.assertEqual(self.check_review(review)["status"], "BLOCKED")

    def test_component_only_scope_and_stale_calibration_block(self):
        review = self.model_fixture()
        self.declared["required_controls"][0]["areas"] = ["mood"]
        self.declared["required_controls"][1]["areas"] = ["mood"]
        self.declaration.write_text(json.dumps(self.declared))
        review["qualification"]["declaration"]["sha256"] = audio.digest(self.declaration)
        self.assertEqual(self.check_review(review)["status"], "BLOCKED")
        review = self.model_fixture();self.result.write_text("changed calibration")
        self.assertEqual(self.check_review(review)["status"], "BLOCKED")

    def test_missing_raw_evidence_and_no_holdout_block(self):
        review = self.model_fixture()
        self.observed["observations"][0]["raw_observation"]["sha256"] = "wrong"
        self.result.write_text(json.dumps(self.observed))
        review["qualification"]["result"]["sha256"] = audio.digest(self.result)
        self.assertEqual(self.check_review(review)["status"], "BLOCKED")
        review = self.model_fixture()
        self.declared["required_controls"][1]["held_out"] = False
        self.declaration.write_text(json.dumps(self.declared))
        review["qualification"]["declaration"]["sha256"] = audio.digest(self.declaration)
        self.assertEqual(self.check_review(review)["status"], "BLOCKED")

    def test_unknown_method_cannot_be_a_fallback(self):
        review = copy.deepcopy(self.review)
        review["review_method"] = "skip"
        self.assertEqual(self.check_review(review)["status"], "BLOCKED")

    def routing_fixture(self, speech=False, windows=None):
        self.packet["signal"]["duration"] = 8
        analysis = self.root / "local-analysis.wav"
        analysis.write_text("Routing-contract fixture only; not audio or listening")
        packet, voice, acoustic = [self.root / name for name in ("route-packet.json", "voice.json", "acoustic.json")]
        packet.write_text(json.dumps(self.packet))
        voice.write_text(json.dumps({"role": "speech_guard", "audio_sha256": audio.digest(analysis), "speech_detected": speech}))
        acoustic.write_text(json.dumps({"role": "acoustic_grounding", "audio_sha256": audio.digest(analysis),
                                        "windows": windows if windows is not None else [{"start": 0, "end": 8, "kind": "music"}]}))
        return packet, voice, acoustic

    def test_routing_success_is_not_creative_approval(self):
        result = audio.instrumental_guard(*self.routing_fixture())
        self.assertEqual(result["status"], "REVIEWABLE_INSTRUMENTAL_MIX")
        self.assertFalse(result["creative_release"])

    def test_signal_fault_stops_before_any_model_evidence_read(self):
        paths = self.routing_fixture()
        self.packet["signal"]["failures"] = ["actual signal fault fixture"]
        paths[0].write_text(json.dumps(self.packet));paths[1].unlink();paths[2].unlink()
        result = audio.instrumental_guard(*paths)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertEqual(result["stopped_before"], "speech/acoustic/music models")

    def test_voice_blocks_even_if_music_model_would_have_called_it_music(self):
        for state in (True, None):
            paths = self.routing_fixture(speech=state);paths[2].unlink()
            result = audio.instrumental_guard(*paths)
            self.assertEqual(result["status"], "BLOCKED")
            self.assertEqual(result["stopped_before"], "acoustic/music models")

    def test_nonmusic_or_incomplete_coverage_does_not_reach_music_critic(self):
        for windows in ([{"start": 0, "end": 8, "kind": "noise"}],
                        [{"start": 0, "end": 6, "kind": "music"}],
                        [{"start": 0, "end": 4, "kind": "music"}, {"start": 4, "end": 8, "kind": "uncertain"}]):
            self.assertEqual(audio.instrumental_guard(*self.routing_fixture(windows=windows))["status"], "BLOCKED")

    def test_source_provenance_cannot_explain_a_different_mix(self):
        paths = self.routing_fixture(windows=[{"start": 0, "end": 4, "kind": "music"}, {"start": 4, "end": 8, "kind": "noise"}])
        provenance = self.root / "provenance.json"
        provenance.write_text(json.dumps({"video_sha256": "wrong", "analysis_sha256": "wrong", "source_files": [],
                                          "explained_nonmusic": [{"start": 4, "end": 8, "reason": "fixture"}]}))
        self.assertEqual(audio.instrumental_guard(*paths, provenance)["status"], "BLOCKED")

    def test_broad_reviewer_pass_cannot_qualify_the_character_role(self):
        path = self.root / "wrong-role.json"
        path.write_text(json.dumps({"role": "full_review", "status": "passed"}))
        with self.assertRaises(ValueError):
            character_qualification(path)

    def test_character_role_binds_actual_raw_controls_and_prompt(self):
        import hashlib
        declaration = self.root / "character-declaration.json"
        declaration.write_text("TEST FIXTURE ONLY; not actual calibration")
        def binding(path):return {"path": str(path), "sha256": audio.digest(path)}
        prompt = "TEST FIXTURE"
        record = {"role": "music_character", "status": "passed", "prompt": prompt,
                  "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(), "declaration": binding(declaration),
                  "observations": [{"id": str(i), "passed": True, "input": binding(self.mix),
                                    "raw_observation": binding(self.response)} for i in range(2)]}
        path = self.root / "character-role.json";path.write_text(json.dumps(record))
        self.assertEqual(character_qualification(path)["role"], "music_character")
        self.response.write_text("changed original control feedback")
        with self.assertRaises(ValueError):
            character_qualification(path)


if __name__ == "__main__":
    unittest.main()
