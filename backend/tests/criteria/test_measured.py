import numpy as np

from winnow.criteria.measured import closures, longest_pause_s, regrasp_count, release_height_m
from winnow.episodes.models import EpisodeSignals


def signals(gripper: list[float], z: list[float] | None = None) -> EpisodeSignals:
    n = len(gripper)
    zs = np.asarray(z if z is not None else [0.0] * n, dtype=np.float64)
    position = np.stack([np.linspace(0, 1, n), np.zeros(n), zs], axis=1)
    return EpisodeSignals(
        episode_index=0,
        fps=15.0,
        timestamps=np.arange(n) / 15.0,
        position=position,
        gripper=np.asarray(gripper, dtype=np.float64),
        dataset_outcome=True,
    )


def test_single_clean_grasp_has_no_regrasps():
    assert regrasp_count(signals([0, 0, 0.6, 0.6, 0.6, 0])) == 0


def test_failed_grasps_before_the_hold_count_as_regrasps():
    gripper = [0, 0.3, 0, 0.5, 0.16, 0.5, 0.6, 0.6, 0]
    assert len(closures(np.asarray(gripper))) == 3
    assert regrasp_count(signals(gripper)) == 2


def test_never_closing_has_no_release_height():
    assert release_height_m(signals([0, 0, 0])) is None


def test_release_height_is_measured_from_the_final_grasp():
    gripper = [0, 0.6, 0.6, 0.6, 0]
    z = [0.0, 0.0, 0.05, 0.10, 0.10]
    assert release_height_m(signals(gripper, z)) == 0.10


def test_long_stillness_mid_episode_is_a_pause():
    n_still = 30  # 2 s at 15 fps
    x = np.concatenate([np.linspace(0, 0.5, 15), np.full(n_still, 0.5), np.linspace(0.5, 1, 15)])
    s = signals([0.0] * len(x))
    s = EpisodeSignals(0, 15.0, s.timestamps, np.stack([x, 0 * x, 0 * x], axis=1), s.gripper, True)
    assert 1.9 <= longest_pause_s(s) <= 2.1
