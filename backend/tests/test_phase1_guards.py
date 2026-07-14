import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main  # noqa: E402


def test_duplicate_hash_groups_detects_cross_channel_collisions():
    groups = backend_main.get_duplicate_hash_groups({1: "aaa", 2: "bbb", 3: "aaa", 4: "ccc"})
    assert groups == [[1, 3]]


def test_resolve_mode_threshold_uses_selected_mode_value():
    policy = backend_main._base_alert_policy()
    policy["operating_mode"] = "startup"
    policy["anomaly_threshold_startup"] = 0.88

    threshold = backend_main._resolve_mode_threshold(policy)
    assert threshold == 0.88


def test_resolve_mode_threshold_falls_back_to_normal():
    policy = backend_main._base_alert_policy()
    policy["operating_mode"] = "unexpected-mode"
    policy["anomaly_threshold_normal"] = 0.77

    threshold = backend_main._resolve_mode_threshold(policy)
    assert threshold == 0.77
