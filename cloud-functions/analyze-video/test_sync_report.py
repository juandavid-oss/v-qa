import importlib.util
import pathlib
import sys
import types
import unittest


def _install_dependency_stubs():
    if "functions_framework" not in sys.modules:
        functions_framework = types.ModuleType("functions_framework")
        functions_framework.http = lambda fn: fn
        sys.modules["functions_framework"] = functions_framework

    if "requests" not in sys.modules:
        requests = types.ModuleType("requests")
        requests.get = lambda *args, **kwargs: None
        requests.post = lambda *args, **kwargs: None
        sys.modules["requests"] = requests

    if "google" not in sys.modules:
        google = types.ModuleType("google")
        sys.modules["google"] = google
    else:
        google = sys.modules["google"]

    if "google.cloud" not in sys.modules:
        google_cloud = types.ModuleType("google.cloud")
        sys.modules["google.cloud"] = google_cloud
    else:
        google_cloud = sys.modules["google.cloud"]
    google.cloud = google_cloud

    if "google.cloud.videointelligence_v1" not in sys.modules:
        vi = types.ModuleType("google.cloud.videointelligence_v1")
        vi.VideoIntelligenceServiceClient = object
        vi.Feature = types.SimpleNamespace(TEXT_DETECTION="TEXT_DETECTION")
        sys.modules["google.cloud.videointelligence_v1"] = vi
    google_cloud.videointelligence_v1 = sys.modules["google.cloud.videointelligence_v1"]

    if "google.protobuf" not in sys.modules:
        protobuf = types.ModuleType("google.protobuf")
        sys.modules["google.protobuf"] = protobuf
    else:
        protobuf = sys.modules["google.protobuf"]
    google.protobuf = protobuf

    if "google.protobuf.json_format" not in sys.modules:
        json_format = types.ModuleType("google.protobuf.json_format")
        json_format.MessageToDict = lambda *args, **kwargs: {}
        sys.modules["google.protobuf.json_format"] = json_format
    protobuf.json_format = sys.modules["google.protobuf.json_format"]

    if "google.generativeai" not in sys.modules:
        generativeai = types.ModuleType("google.generativeai")
        generativeai.configure = lambda **kwargs: None
        generativeai.upload_file = lambda *args, **kwargs: types.SimpleNamespace(name="dummy-audio")
        generativeai.delete_file = lambda *args, **kwargs: None
        generativeai.GenerativeModel = lambda *_args, **_kwargs: types.SimpleNamespace(
            generate_content=lambda *_a, **_k: types.SimpleNamespace(text="[]")
        )
        sys.modules["google.generativeai"] = generativeai
    google.generativeai = sys.modules["google.generativeai"]

    if "supabase" not in sys.modules:
        supabase = types.ModuleType("supabase")
        supabase.create_client = lambda *args, **kwargs: object()
        sys.modules["supabase"] = supabase


def _load_main_module():
    _install_dependency_stubs()
    path = pathlib.Path(__file__).resolve().parent / "main.py"
    spec = importlib.util.spec_from_file_location("analyze_video_main", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load main.py for tests")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MAIN = _load_main_module()


class SyncReportTests(unittest.TestCase):
    def test_normalize_text_for_sync(self):
        normalized = MAIN._normalize_text_for_sync("  Hello,   WORLD!!  ")
        self.assertEqual(normalized, "hello world")
        self.assertEqual(MAIN._normalize_text_for_sync("fifty percent"), "50 percent")

    def test_build_segment_word_windows(self):
        windows = MAIN._build_segment_word_windows({
            "text": "one two three",
            "start_time": 0.0,
            "end_time": 3.0,
        })
        self.assertEqual(len(windows), 3)
        self.assertEqual(windows[0]["token"], "1")
        self.assertAlmostEqual(windows[0]["start_time"], 0.0, places=6)
        self.assertAlmostEqual(windows[0]["end_time"], 1.0, places=6)
        self.assertAlmostEqual(windows[2]["start_time"], 2.0, places=6)
        self.assertAlmostEqual(windows[2]["end_time"], 3.0, places=6)

    def test_compute_word_overlap_ratio(self):
        ratio = MAIN._compute_word_overlap_ratio(
            ["i", "remember", "back"],
            ["i", "remember", "that"],
        )
        self.assertAlmostEqual(ratio, 2 / 3, places=6)
        self.assertEqual(MAIN._compute_word_overlap_ratio([], ["x"]), 0.0)

    def test_levenshtein_distance(self):
        self.assertEqual(MAIN._levenshtein_distance("kitten", "sitting"), 3)
        self.assertEqual(MAIN._levenshtein_distance("sync", "sync"), 0)

    def test_detect_subtitle_overlaps(self):
        subtitles = [
            {"text": "a", "start_time": 0.0, "end_time": 1.0},
            {"text": "b", "start_time": 0.5, "end_time": 1.5},
            {"text": "c", "start_time": 2.0, "end_time": 3.0},
        ]
        overlaps = MAIN._detect_subtitle_overlaps(subtitles)
        self.assertEqual(len(overlaps), 1)
        self.assertEqual(overlaps[0]["subtitle_indices"], [0, 1])
        self.assertEqual(overlaps[0]["texts"], ["a", "b"])

    def test_build_sync_report_thresholds(self):
        subtitles = [
            {"text": "so reality check", "start_time": 0.0, "end_time": 1.0},
            {"text": "i remember back", "start_time": 1.0, "end_time": 2.0},
            {"text": "nothing matches", "start_time": 2.0, "end_time": 3.0},
        ]
        transcriptions = [
            {"text": "so reality check", "start_time": 0.0, "end_time": 1.0},
            {"text": "i remember that", "start_time": 1.0, "end_time": 2.0},
            {"text": "different words", "start_time": 2.0, "end_time": 3.0},
        ]
        report = MAIN.build_sync_report(subtitles, transcriptions, offset_window_seconds=1.5)
        statuses = [d["status"] for d in report["details"]]
        self.assertEqual(statuses, ["SYNCED", "LIKELY_SYNCED", "MISALIGNED"])
        self.assertEqual(report["summary"]["synced"], 1)
        self.assertEqual(report["summary"]["likely_synced"], 1)
        self.assertEqual(report["summary"]["misaligned"], 1)

    def test_find_best_temporal_offset(self):
        subtitle = {"text": "hello world", "start_time": 0.0, "end_time": 1.0}
        transcriptions = [
            {"text": "hello world", "start_time": 1.0, "end_time": 2.0},
        ]
        offset = MAIN._find_best_temporal_offset(subtitle, transcriptions, window=1.5, step=0.1)
        self.assertTrue(offset["material_improvement"])
        self.assertAlmostEqual(offset["best_ratio"], 1.0, places=3)
        self.assertGreater(offset["best_offset_seconds"], 0.0)
        self.assertLessEqual(offset["best_offset_seconds"], 1.0)

    def test_detect_mismatches_only_misaligned(self):
        subtitles = [
            {"text": "so reality check", "start_time": 0.0, "end_time": 1.0},
            {"text": "nothing matches", "start_time": 1.0, "end_time": 2.0},
        ]
        transcriptions = [
            {"text": "so reality check", "start_time": 0.0, "end_time": 1.0},
            {"text": "different words", "start_time": 1.0, "end_time": 2.0},
        ]
        mismatches = MAIN.detect_mismatches(subtitles, transcriptions)
        self.assertEqual(len(mismatches), 1)
        self.assertEqual(mismatches[0]["severity"], "high")
        self.assertEqual(mismatches[0]["subtitle_text"], "nothing matches")

    def test_build_sync_report_smoke_shape(self):
        report = MAIN.build_sync_report(
            subtitles=[{"text": "hello", "start_time": 0.0, "end_time": 1.0}],
            transcriptions=[{"text": "hello", "start_time": 0.0, "end_time": 1.0}],
            offset_window_seconds=1.5,
        )
        self.assertIn("summary", report)
        self.assertIn("details", report)
        self.assertIn("duplicates", report)
        self.assertEqual(report["summary"]["total_subtitles"], 1)


if __name__ == "__main__":
    unittest.main()
