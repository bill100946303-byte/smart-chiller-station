#!/usr/bin/env python3
"""Run the existing chilled-water-plant Blender delivery pipeline safely."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_WORKSPACE = Path(__file__).resolve().parents[4]
DEFAULT_BLENDER = Path("/Applications/Blender.app/Contents/MacOS/Blender")
INTERFACE_TOLERANCE_M = 0.005
CHILLER_COUNT = 7
TOWER_GROUP_FAN_COUNTS = (6, 6, 6, 6, 6, 3)
TOWER_COUNT = sum(TOWER_GROUP_FAN_COUNTS)
EXPECTED_EQUIPMENT_INSTANCES = 65
EXPECTED_CORE_BINDINGS = 54
EXPECTED_PROCESS_PORT_ANCHORS = 132
EXPECTED_2D_POINT_BINDINGS = 64
EXPECTED_2D_FLOW_EDGES = 122
EXPECTED_2D_DECLARED_CROSSOVERS = 20
EXPECTED_RUNTIME_ANIMATION_TARGETS = 62
EXPECTED_EMBEDDED_ANIMATION_EFFECTS = 63
EXPECTED_PUMP_ROTATION_MARKERS = 14
EXPECTED_TOPOLOGY_EDGES = 118
EXPECTED_INTERFACE_COUNTS = {
    "primary_interface_checks": 140,
    "header_interface_checks": 151,
    "tower_equalizer_interface_checks": 33,
    "centerline_snapped_accessories": 126,
}
INTERFACE_METRICS = (
    "primary_interface_max_gap_m",
    "header_interface_max_gap_m",
    "tower_equalizer_max_clear_gap_m",
    "accessory_centerline_max_offset_m",
)
EXPECTED_PIPE_CLEARANCE_CHECKS = 55
PIPE_CLEARANCE_MARGIN_M = 0.02
EXPECTED_PUMP_BYPASS_CLEARANCE_CHECKS = 14
PUMP_BYPASS_REQUIRED_SURFACE_GAP_M = 0.30
EXPECTED_MANIFOLD_PORT_AXIS_CHECKS = 10
MANIFOLD_PORT_AXIS_TOLERANCE_DEG = 2.0
EXPECTED_MANIFOLD_BRANCH_NECK_CHECKS = 8
MANIFOLD_BRANCH_MIN_STRAIGHT_NECK_M = 0.30
FORBIDDEN_ACCESSORIES = {"isolation_valve", "check_valve", "y_strainer"}
EXPECTED_ACCESSORIES = {
    "flexible_connector": 56,
    "instrument_probe": 56,
    "flow_meter": 14,
    "boundary_flange": 8,
    "automatic_air_vent": 4,
    "low_point_drain": 4,
    "side_stream_water_treatment_skid": 1,
}
EXPECTED_ANIMATION_EFFECT_COUNTS = {
    "cooling_tower_fan_rotation": TOWER_COUNT,
    "pump_drive_shaft_rotation": CHILLER_COUNT * 2,
    "chilled_water_flow_pulse": 8,
    "main_header_flow_band": 8,
}
EXPECTED_OVERVIEW_COUNTS = {
    "latest_equipment_instances": EXPECTED_EQUIPMENT_INSTANCES,
    "cooling_tower_groups": len(TOWER_GROUP_FAN_COUNTS),
    "cooling_tower_fans_per_group": list(TOWER_GROUP_FAN_COUNTS),
    "cooling_tower_fan_cells": TOWER_COUNT,
    "engineering_accessory_roots": sum(EXPECTED_ACCESSORIES.values()),
    "runtime_animation_targets": EXPECTED_RUNTIME_ANIMATION_TARGETS,
    "embedded_animation_effects": EXPECTED_EMBEDDED_ANIMATION_EFFECTS,
    "embedded_animation_tracks": EXPECTED_EMBEDDED_ANIMATION_EFFECTS,
    "flow_surface_segments": 16,
    "flow_ring_objects": 0,
    "pump_rotation_markers": EXPECTED_PUMP_ROTATION_MARKERS,
    "topology_edges": EXPECTED_TOPOLOGY_EDGES,
    "external_boundary_ports": 12,
}
LOD_LIMITS = {
    "LOD0": {"triangles": (2_400_000, 3_200_000), "max_bytes": 9 * 1024 * 1024},
    "LOD1": {"triangles": (600_000, 900_000), "max_bytes": 5 * 1024 * 1024},
    "LOD2": {"triangles": (250_000, 400_000), "max_bytes": 4 * 1024 * 1024},
}

SOURCE_BLEND_PATHS = (
    "apps/chiller-shell-v1/public/models/chiller/source/blender/chiller-centrifugal-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/cooling-tower/source/blender/cooling-tower-crossflow-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/pump/source/blender/pump-horizontal-split-case-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/plc-control-cabinet/source/blender/plc-control-cabinet-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/solenoid-valve/source/blender/solenoid-valve-flanged-dn50-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/pressure-gauge/source/blender/pressure-gauge-radial-dn100-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/temperature-gauge/source/blender/temperature-gauge-bimetal-dn100-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/supply-return-manifold/source/blender/supply-return-manifold-four-branch-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/cooling-water-dosing-skid/source/blender/cooling-water-automatic-dosing-skid-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/pressurization-water-makeup-skid/source/blender/pressurization-water-makeup-skid-generic-v1.blend",
    "apps/chiller-shell-v1/public/models/differential-pressure-transmitter/source/blender/differential-pressure-transmitter-wet-wet-generic-v1.blend",
)
SCRIPT_PATHS = {
    "generate": "output/blender/generate_chilled_water_plant_overview_latest_v2.py",
    "reimport": "output/blender/validate_chilled_water_plant_overview_latest_v2.py",
    "lod": "output/blender/generate_chilled_water_plant_overview_lod.py",
    "render": "output/blender/render_chilled_water_plant_overview_latest_v2_orbit.py",
    "audit": "output/blender/audit_final_model_suite_v2.py",
    "render_2d_components": "output/blender/render_scada_component_thumbnails.py",
    "build_2d": "apps/chiller-shell-v1/scripts/build-plant-2d-physical.mjs",
    "validate_2d": "apps/chiller-shell-v1/scripts/validate-plant-2d.mjs",
    "generate_dosing_skid": "output/blender/generate_cooling_water_automatic_dosing_skid_generic_v1.py",
    "validate_dosing_skid": "output/blender/validate_cooling_water_automatic_dosing_skid_generic_v1.py",
    "generate_water_makeup_skid": "output/blender/generate_pressurization_water_makeup_skid_generic_v1.py",
    "validate_water_makeup_skid": "output/blender/validate_pressurization_water_makeup_skid_generic_v1.py",
    "generate_dp_transmitter": "output/blender/generate_differential_pressure_transmitter_generic_v1.py",
    "validate_dp_transmitter": "output/blender/validate_differential_pressure_transmitter_generic_v1.py",
    "render_dp_transmitter": "output/blender/render_differential_pressure_transmitter_inspection_views.py",
}
OVERVIEW_BLEND = (
    "apps/chiller-shell-v1/public/models/plant-overview/source/blender/"
    "chilled-water-plant-overview-latest-v2.blend"
)
REPORT_PATHS = {
    "source_generation": "output/blender/chilled-water-plant-overview-latest-v2-report.json",
    "glb_reimport": "output/blender/chilled-water-plant-overview-latest-v2-reimport-report.json",
    "lod1": "output/blender/chilled-water-plant-overview-latest-v2-lod1-report.json",
    "lod2": "output/blender/chilled-water-plant-overview-latest-v2-lod2-report.json",
    "orbit_render": (
        "output/blender/chilled-water-plant-overview-latest-v2-orbit/"
        "orbit-render-report.json"
    ),
    "final_audit": "output/blender/final-model-suite-audit-v2.json",
    "component_2d_render": "output/blender/2d-physical-assets/scada-component-render-report.json",
    "png_2d_provenance": "output/blender/chilled-water-plant-overview-latest-v2-2d-provenance.json",
    "plant_2d_validation": "output/blender/chilled-water-plant-overview-latest-v2-2d-validation.json",
    "dosing_skid_generation": "output/blender/cooling-water-automatic-dosing-skid-generic-v1-report.json",
    "dosing_skid_reimport": "output/blender/cooling-water-automatic-dosing-skid-generic-v1-reimport-report.json",
    "water_makeup_generation": "output/blender/pressurization-water-makeup-skid-generic-v1-report.json",
    "water_makeup_reimport": "output/blender/pressurization-water-makeup-skid-generic-v1-reimport-report.json",
    "dp_transmitter_generation": "output/blender/differential-pressure-transmitter-wet-wet-generic-v1-report.json",
    "dp_transmitter_reimport": "output/blender/differential-pressure-transmitter-wet-wet-generic-v1-reimport-report.json",
    "dp_transmitter_inspection": (
        "output/blender/differential-pressure-transmitter-wet-wet-generic-v1-inspection/"
        "inspection-render-report.json"
    ),
}
STAGE_REPORT_LABELS = {
    "generate_overview": "source_generation",
    "validate_glb_reimport": "glb_reimport",
    "generate_lod1": "lod1",
    "generate_lod2": "lod2",
    "render_orbit": "orbit_render",
    "final_audit": "final_audit",
    "render_2d_components": "component_2d_render",
    "build_2d": "png_2d_provenance",
    "validate_2d": "plant_2d_validation",
    "generate_dosing_skid": "dosing_skid_generation",
    "validate_dosing_skid": "dosing_skid_reimport",
    "generate_water_makeup_skid": "water_makeup_generation",
    "validate_water_makeup_skid": "water_makeup_reimport",
    "generate_dp_transmitter": "dp_transmitter_generation",
    "validate_dp_transmitter": "dp_transmitter_reimport",
    "render_dp_transmitter": "dp_transmitter_inspection",
}
GIF_PATH = "output/blender/chilled-water-plant-overview-latest-v2-orbit.gif"
B25_BINDING_PATH = (
    "apps/chiller-shell-v1/public/models/plant-overview/bindings/"
    "b25-plant-overview-binding-v2.json"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the existing Blender chilled-water-plant delivery pipeline."
    )
    parser.add_argument(
        "--mode",
        choices=("full", "validate-only", "render-only"),
        default="full",
    )
    parser.add_argument(
        "--workspace",
        type=Path,
        default=DEFAULT_WORKSPACE,
        help="Project root; defaults to the project containing this Skill.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect inputs and print commands without creating outputs.",
    )
    return parser.parse_args()


def resolve_binary(name: str, preferred: Path | None = None) -> str | None:
    if preferred and preferred.is_file():
        return str(preferred)
    return shutil.which(name)


def find_conflicts(workspace: Path) -> list[str]:
    models = workspace / "apps/chiller-shell-v1/public/models"
    orbit = workspace / "output/blender/chilled-water-plant-overview-latest-v2-orbit"
    conflicts: set[Path] = set(models.rglob("*.blend1")) if models.is_dir() else set()
    if models.is_dir():
        conflicts.update(
            path
            for path in models.rglob("*.blend")
            if re.search(r" [23]\.blend$", path.name)
        )
    if orbit.is_dir():
        conflicts.update(
            path
            for path in orbit.glob("frame_*.png")
            if re.fullmatch(r"frame_\d{3} [23]\.png", path.name)
        )
    return sorted(str(path.relative_to(workspace)) for path in conflicts)


def preflight(workspace: Path) -> dict[str, Any]:
    blender = resolve_binary(
        "blender",
        Path(os.environ.get("BLENDER_BIN", str(DEFAULT_BLENDER))).expanduser(),
    )
    binaries = {
        "blender": blender,
        "ffmpeg": resolve_binary("ffmpeg"),
        "ffprobe": resolve_binary("ffprobe"),
        "npm": resolve_binary("npm"),
        "python": sys.executable,
    }
    required = [workspace / path for path in SOURCE_BLEND_PATHS]
    required.extend(workspace / path for path in SCRIPT_PATHS.values())
    required.extend(
        (
            workspace / OVERVIEW_BLEND,
            workspace / "apps/chiller-shell-v1/public/models/model-manifest-v1.json",
            workspace / B25_BINDING_PATH,
        )
    )
    missing_files = sorted(
        str(path.relative_to(workspace)) for path in required if not path.is_file()
    )
    missing_binaries = sorted(name for name, value in binaries.items() if value is None)
    conflicts = find_conflicts(workspace)
    blockers: list[str] = []
    if missing_files:
        blockers.append("missing_required_files")
    if missing_binaries:
        blockers.append("missing_required_binaries")
    if conflicts:
        blockers.append("duplicate_or_backup_files")
    return {
        "status": "PASS" if not blockers else "BLOCKED",
        "binaries": binaries,
        "missing_files": missing_files,
        "missing_binaries": missing_binaries,
        "conflicts": conflicts,
        "blockers": blockers,
    }


def stage_commands(
    workspace: Path, binaries: dict[str, str | None], mode: str
) -> list[tuple[str, list[str]]]:
    blender = str(binaries["blender"])
    ffmpeg = str(binaries["ffmpeg"])
    npm = str(binaries["npm"])
    python = str(binaries["python"])
    blend = str(workspace / OVERVIEW_BLEND)
    commands = {
        "generate_dosing_skid": [
            blender,
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["generate_dosing_skid"]),
        ],
        "validate_dosing_skid": [
            blender,
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["validate_dosing_skid"]),
        ],
        "generate_water_makeup_skid": [
            blender,
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["generate_water_makeup_skid"]),
        ],
        "validate_water_makeup_skid": [
            blender,
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["validate_water_makeup_skid"]),
        ],
        "generate_dp_transmitter": [
            blender,
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["generate_dp_transmitter"]),
        ],
        "validate_dp_transmitter": [
            blender,
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["validate_dp_transmitter"]),
        ],
        "render_dp_transmitter": [
            blender,
            str(
                workspace
                / "apps/chiller-shell-v1/public/models/"
                "differential-pressure-transmitter/source/blender/"
                "differential-pressure-transmitter-wet-wet-generic-v1.blend"
            ),
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["render_dp_transmitter"]),
        ],
        "generate_overview": [
            blender,
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["generate"]),
        ],
        "validate_glb_reimport": [
            blender,
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["reimport"]),
        ],
        "generate_lod1": [
            blender,
            "--background",
            blend,
            "--python",
            str(workspace / SCRIPT_PATHS["lod"]),
            "--",
            "LOD1",
            "0.28",
        ],
        "generate_lod2": [
            blender,
            "--background",
            blend,
            "--python",
            str(workspace / SCRIPT_PATHS["lod"]),
            "--",
            "LOD2",
            "0.10",
        ],
        "render_orbit": [
            blender,
            "--background",
            blend,
            "--python",
            str(workspace / SCRIPT_PATHS["render"]),
        ],
        "assemble_gif": [
            ffmpeg,
            "-y",
            "-framerate",
            "2",
            "-i",
            str(
                workspace
                / "output/blender/chilled-water-plant-overview-latest-v2-orbit/frame_%03d.png"
            ),
            "-filter_complex",
            "[0:v]split[a][b];[a]palettegen=max_colors=192[p];"
            "[b][p]paletteuse=dither=bayer:bayer_scale=3",
            "-loop",
            "0",
            str(workspace / GIF_PATH),
        ],
        "render_2d_components": [
            blender,
            "--background",
            "--python",
            str(workspace / SCRIPT_PATHS["render_2d_components"]),
        ],
        "build_2d": [
            npm,
            "--prefix",
            str(workspace / "apps/chiller-shell-v1"),
            "run",
            "build:plant-2d-physical",
        ],
        "validate_2d": [
            npm,
            "--prefix",
            str(workspace / "apps/chiller-shell-v1"),
            "run",
            "check:plant-2d",
        ],
        "final_audit": [python, str(workspace / SCRIPT_PATHS["audit"])],
    }
    if mode == "full":
        order = (
            "generate_dosing_skid",
            "validate_dosing_skid",
            "generate_water_makeup_skid",
            "validate_water_makeup_skid",
            "generate_dp_transmitter",
            "validate_dp_transmitter",
            "render_dp_transmitter",
            "generate_overview",
            "validate_glb_reimport",
            "generate_lod1",
            "generate_lod2",
            "render_orbit",
            "assemble_gif",
            "render_2d_components",
            "build_2d",
            "validate_2d",
            "final_audit",
        )
    elif mode == "validate-only":
        order = (
            "validate_dosing_skid",
            "validate_water_makeup_skid",
            "validate_dp_transmitter",
            "validate_glb_reimport",
            "validate_2d",
            "final_audit",
        )
    else:
        order = (
            "render_dp_transmitter",
            "render_orbit",
            "assemble_gif",
            "render_2d_components",
            "build_2d",
            "validate_2d",
        )
    return [(name, commands[name]) for name in order]


def run_stage(
    name: str, command: list[str], workspace: Path, environment: dict[str, str]
) -> dict[str, Any]:
    print(f"[{name}] {' '.join(command)}", flush=True)
    started = time.monotonic()
    started_epoch = time.time()
    completed = subprocess.run(
        command,
        cwd=workspace,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    combined_output = f"{completed.stdout}\n{completed.stderr}"
    failure_reasons: list[str] = []
    if completed.returncode != 0:
        failure_reasons.append(f"returncode={completed.returncode}")
    if "Traceback (most recent call last):" in combined_output:
        failure_reasons.append("python_traceback_detected")
    report_label = STAGE_REPORT_LABELS.get(name)
    if report_label is not None:
        report_path = workspace / REPORT_PATHS[report_label]
        if not report_path.is_file():
            failure_reasons.append(f"missing_stage_report={report_path}")
        elif report_path.stat().st_mtime < started_epoch - 1.0:
            failure_reasons.append(f"stale_stage_report={report_path}")
        else:
            try:
                if load_json(report_path).get("status") != "PASS":
                    failure_reasons.append(f"stage_report_not_pass={report_path}")
            except Exception as error:
                failure_reasons.append(f"invalid_stage_report={report_path}:{error}")
    elif name == "assemble_gif":
        gif_path = workspace / GIF_PATH
        if not gif_path.is_file() or gif_path.stat().st_mtime < started_epoch - 1.0:
            failure_reasons.append(f"missing_or_stale_gif={gif_path}")
    result = {
        "name": name,
        "command": command,
        "returncode": completed.returncode,
        "elapsed_seconds": round(time.monotonic() - started, 3),
        "stdout_tail": completed.stdout[-4000:],
        "stderr_tail": completed.stderr[-4000:],
        "failure_reasons": failure_reasons,
        "status": "PASS" if not failure_reasons else "FAIL",
    }
    if failure_reasons:
        print(completed.stdout[-2000:], file=sys.stderr)
        print(completed.stderr[-2000:], file=sys.stderr)
    return result


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def verify_b25_binding_contract(workspace: Path) -> dict[str, Any]:
    path = workspace / B25_BINDING_PATH
    contract = load_json(path)
    authority = contract.get("authority", {})
    access_policy = contract.get("accessPolicy", {})
    bindings = contract.get("bindings", [])
    runtime_group_counts: dict[str, int] = {}
    for binding in bindings:
        group = str(binding.get("runtimeGroup", ""))
        runtime_group_counts[group] = runtime_group_counts.get(group, 0) + 1
    expected_runtime_group_counts = {
        "chillers": CHILLER_COUNT,
        "chilledPumps": CHILLER_COUNT,
        "coolingPumps": CHILLER_COUNT,
        "coolingTowers": TOWER_COUNT,
    }
    if (
        not isinstance(contract.get("status"), str)
        or not contract.get("status")
        or contract.get("authoritative") is not False
        or authority.get("identity") is not True
        or authority.get("telemetry") is not False
        or authority.get("geometryTopology") is not False
        or contract.get("controlBoundary")
        != "visualization_only_no_ba_plc_write"
        or access_policy.get("readOnly") is not True
        or access_policy.get("allowedMethods") != ["GET"]
        or access_policy.get("writeEndpoints") != []
        or len(bindings) != EXPECTED_CORE_BINDINGS
        or runtime_group_counts != expected_runtime_group_counts
        or len({binding.get("equipmentId") for binding in bindings})
        != EXPECTED_CORE_BINDINGS
        or len(
            {
                binding.get("deviceIdRef", binding.get("deviceId"))
                for binding in bindings
            }
        )
        != EXPECTED_CORE_BINDINGS
    ):
        raise RuntimeError(
            "B25 binding contract failed: "
            f"authority={authority}, bindings={len(bindings)}, "
            f"runtime_groups={runtime_group_counts}"
        )
    return {
        "status": "PASS",
        "path": str(path),
        "contract_status": contract["status"],
        "core_bindings": len(bindings),
        "runtime_group_counts": runtime_group_counts,
        "identity_authoritative": True,
        "telemetry_authoritative": False,
        "geometry_topology_authoritative": False,
        "control_boundary": contract["controlBoundary"],
    }


def verify_overview_counts(report: dict[str, Any], label: str) -> dict[str, Any]:
    counts = {key: report.get(key) for key in EXPECTED_OVERVIEW_COUNTS}
    if (
        counts != EXPECTED_OVERVIEW_COUNTS
        or report.get("cooling_tower_group_fan_axis") != "X"
        or report.get("embedded_animation_effect_counts")
        != EXPECTED_ANIMATION_EFFECT_COUNTS
    ):
        raise RuntimeError(
            f"{label} overview count contract failed: counts={counts}, "
            f"animation={report.get('embedded_animation_effect_counts')}"
        )
    return {
        "status": "PASS",
        "counts": counts,
        "animation_effect_counts": EXPECTED_ANIMATION_EFFECT_COUNTS,
    }


def verify_lod_budget(level: str, report: dict[str, Any]) -> dict[str, Any]:
    limits = LOD_LIMITS[level]
    triangles = int(report.get("triangles_evaluated", -1))
    glb_bytes = int(report.get("glb_bytes", -1))
    minimum, maximum = limits["triangles"]
    if not minimum <= triangles <= maximum or not 0 < glb_bytes <= limits["max_bytes"]:
        raise RuntimeError(
            f"{level} delivery budget failed: triangles={triangles}, "
            f"bytes={glb_bytes}, limits={limits}"
        )
    return {
        "status": "PASS",
        "triangles": triangles,
        "bytes": glb_bytes,
        "max_bytes": limits["max_bytes"],
    }


def probe_gif(workspace: Path, ffprobe: str) -> dict[str, Any]:
    completed = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-count_frames",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,nb_read_frames,duration",
            "-of",
            "json",
            str(workspace / GIF_PATH),
        ],
        cwd=workspace,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {completed.stderr[-1000:]}")
    stream = json.loads(completed.stdout)["streams"][0]
    result = {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "frames": int(stream["nb_read_frames"]),
        "duration_seconds": float(stream["duration"]),
    }
    result["playback_fps"] = round(
        result["frames"] / result["duration_seconds"], 3
    )
    if (
        result["width"] != 960
        or result["height"] != 540
        or result["frames"] != 24
        or not 11.9 <= result["duration_seconds"] <= 12.1
        or not 1.9 <= result["playback_fps"] <= 2.1
    ):
        raise RuntimeError(f"GIF contract failed: {result}")
    return result


def verify_interface_report(report: dict[str, Any], label: str) -> dict[str, Any]:
    tolerance = float(report.get("interface_tolerance_m", -1.0))
    counts = {key: report.get(key) for key in EXPECTED_INTERFACE_COUNTS}
    metrics = {key: float(report.get(key, 999.0)) for key in INTERFACE_METRICS}
    accessories = report.get("engineering_accessory_counts", {})
    forbidden_present = sorted(FORBIDDEN_ACCESSORIES.intersection(accessories))
    geometry = {
        "pipe_clearance_status": report.get("pipe_clearance_validation_status"),
        "pipe_clearance_checks": int(report.get("pipe_clearance_checks", -1)),
        "pipe_clearance_violations": int(report.get("pipe_clearance_violations", -1)),
        "pipe_clearance_min_surface_gap_m": float(
            report.get("pipe_clearance_min_surface_gap_m", -1.0)
        ),
        "pump_bypass_status": report.get(
            "pump_bypass_clearance_validation_status"
        ),
        "pump_bypass_checks": int(
            report.get("pump_bypass_clearance_checks", -1)
        ),
        "pump_bypass_violations": int(
            report.get("pump_bypass_clearance_violations", -1)
        ),
        "pump_bypass_min_surface_gap_m": float(
            report.get("pump_bypass_min_surface_gap_m", -1.0)
        ),
        "manifold_port_status": report.get("manifold_port_alignment_status"),
        "manifold_port_axis_checks": int(report.get("manifold_port_axis_checks", -1)),
        "manifold_port_max_axis_angle_deg": float(
            report.get("manifold_port_max_axis_angle_deg", 999.0)
        ),
        "manifold_branch_straight_neck_checks": int(
            report.get("manifold_branch_straight_neck_checks", -1)
        ),
        "manifold_branch_min_straight_neck_m": float(
            report.get("manifold_branch_min_straight_neck_m", -1.0)
        ),
    }
    if (
        report.get("status") != "PASS"
        or report.get("interface_validation_status") != "PASS"
        or abs(tolerance - INTERFACE_TOLERANCE_M) > 1e-9
        or counts != EXPECTED_INTERFACE_COUNTS
        or max(metrics.values()) > tolerance
        or accessories != EXPECTED_ACCESSORIES
        or forbidden_present
        or geometry["pipe_clearance_status"] != "PASS"
        or geometry["pipe_clearance_checks"] != EXPECTED_PIPE_CLEARANCE_CHECKS
        or geometry["pipe_clearance_violations"] != 0
        or geometry["pipe_clearance_min_surface_gap_m"] < PIPE_CLEARANCE_MARGIN_M
        or geometry["pump_bypass_status"] != "PASS"
        or geometry["pump_bypass_checks"] != EXPECTED_PUMP_BYPASS_CLEARANCE_CHECKS
        or geometry["pump_bypass_violations"] != 0
        or geometry["pump_bypass_min_surface_gap_m"]
        < PUMP_BYPASS_REQUIRED_SURFACE_GAP_M
        or geometry["manifold_port_status"] != "PASS"
        or geometry["manifold_port_axis_checks"] != EXPECTED_MANIFOLD_PORT_AXIS_CHECKS
        or geometry["manifold_port_max_axis_angle_deg"]
        > MANIFOLD_PORT_AXIS_TOLERANCE_DEG
        or geometry["manifold_branch_straight_neck_checks"]
        != EXPECTED_MANIFOLD_BRANCH_NECK_CHECKS
        or geometry["manifold_branch_min_straight_neck_m"]
        < MANIFOLD_BRANCH_MIN_STRAIGHT_NECK_M
    ):
        raise RuntimeError(
            f"{label} interface contract failed: counts={counts}, "
            f"metrics={metrics}, geometry={geometry}, accessories={accessories}"
        )
    return {
        "status": "PASS",
        "tolerance_m": tolerance,
        "counts": counts,
        "metrics": metrics,
        "geometry": geometry,
        "forbidden_accessories_present": forbidden_present,
    }


def verify_dosing_skid_report(report: dict[str, Any], label: str) -> dict[str, Any]:
    expected_counts = {
        "chemical_tanks": 2,
        "metering_pumps": 2,
        "agitators": 2,
        "calibration_columns": 2,
        "sample_panels": 1,
        "control_cabinets": 1,
        "fluid_ports": 6,
        "cable_ports": 2,
        "port_surface_checks": 8,
        "port_axis_checks": 8,
        "embedded_animation_effects": 4,
        "embedded_animation_tracks": 4,
        "prohibited_external_components": 0,
    }
    actual_counts = {key: int(report.get(key, -1)) for key in expected_counts}
    expected_animation_counts = {
        "chemical_tank_agitator_rotation": 2,
        "metering_pump_diaphragm_reciprocation": 2,
    }
    if (
        report.get("status") != "PASS"
        or actual_counts != expected_counts
        or int(report.get("runtime_bindings", -1)) < 25
        or float(report.get("port_surface_max_gap_m", 999.0)) > 0.005
        or float(report.get("port_axis_max_angle_deg", 999.0)) > 2.0
        or report.get("embedded_animation_effect_counts")
        != expected_animation_counts
        or report.get("brand_marks") != "none"
        or report.get("plant_overview_integration")
        != "standalone_asset_not_installed_in_current_overview"
        or not 20_000 <= int(report.get("triangles_evaluated", -1)) <= 180_000
        or not 0 < int(report.get("glb_bytes", -1)) <= 6 * 1024 * 1024
    ):
        raise RuntimeError(
            f"{label} cooling-water dosing skid contract failed: "
            f"counts={actual_counts}, report={report}"
        )
    return {
        "status": "PASS",
        "dimensions_m": report["dimensions_m"],
        "triangles": int(report["triangles_evaluated"]),
        "glb_bytes": int(report["glb_bytes"]),
        "runtime_bindings": int(report["runtime_bindings"]),
        "counts": actual_counts,
        "port_surface_max_gap_m": float(report["port_surface_max_gap_m"]),
        "port_axis_max_angle_deg": float(report["port_axis_max_angle_deg"]),
        "animation_effect_counts": report["embedded_animation_effect_counts"],
        "plant_overview_integration": report["plant_overview_integration"],
        "brand_marks": report["brand_marks"],
    }


def verify_water_makeup_skid_report(
    report: dict[str, Any], label: str
) -> dict[str, Any]:
    expected_counts = {
        "pressure_vessels": 1,
        "makeup_pumps": 2,
        "control_cabinets": 1,
        "pressure_gauges": 1,
        "pressure_transmitters": 1,
        "low_water_sensors": 1,
        "fluid_ports": 4,
        "cable_ports": 2,
        "port_surface_checks": 6,
        "port_axis_checks": 6,
        "embedded_animation_effects": 2,
        "embedded_animation_tracks": 2,
        "prohibited_external_components": 0,
    }
    actual_counts = {key: int(report.get(key, -1)) for key in expected_counts}
    expected_animation_counts = {"makeup_pump_drive_shaft_rotation": 2}
    dimensions = [float(value) for value in report.get("dimensions_m", [])]
    if (
        report.get("status") != "PASS"
        or actual_counts != expected_counts
        or int(report.get("runtime_bindings", -1)) < 30
        or float(report.get("port_surface_max_gap_m", 999.0)) > 0.005
        or float(report.get("port_axis_max_angle_deg", 999.0)) > 2.0
        or report.get("embedded_animation_effect_counts")
        != expected_animation_counts
        or report.get("brand_marks") != "none"
        or report.get("plant_overview_integration")
        != "standalone_asset_not_installed_in_current_overview"
        or report.get("control_boundary")
        != "read_only_digital_twin_no_BA_or_PLC_write"
        or not 30_000 <= int(report.get("triangles_evaluated", -1)) <= 120_000
        or not 0 < int(report.get("glb_bytes", -1)) <= 6 * 1024 * 1024
        or len(dimensions) != 3
        or not 3.25 <= dimensions[0] <= 3.50
        or not 1.55 <= dimensions[1] <= 1.80
        or not 2.10 <= dimensions[2] <= 2.32
        or len(str(report.get("glb_sha256", ""))) != 64
        or len(str(report.get("blend_sha256", ""))) != 64
    ):
        raise RuntimeError(
            f"{label} pressurization water-makeup skid contract failed: "
            f"counts={actual_counts}, report={report}"
        )
    return {
        "status": "PASS",
        "asset": report["asset"],
        "dimensions_m": report["dimensions_m"],
        "triangles": int(report["triangles_evaluated"]),
        "glb_bytes": int(report["glb_bytes"]),
        "glb_sha256": report["glb_sha256"],
        "blend_sha256": report["blend_sha256"],
        "runtime_bindings": int(report["runtime_bindings"]),
        "counts": actual_counts,
        "port_surface_max_gap_m": float(report["port_surface_max_gap_m"]),
        "port_axis_max_angle_deg": float(report["port_axis_max_angle_deg"]),
        "animation_effect_counts": report["embedded_animation_effect_counts"],
        "plant_overview_integration": report["plant_overview_integration"],
        "control_boundary": report["control_boundary"],
        "brand_marks": report["brand_marks"],
    }


def verify_dp_transmitter_report(
    report: dict[str, Any], label: str
) -> dict[str, Any]:
    expected_counts = {
        "differential_pressure_transmitters": 1,
        "sensor_capsules": 1,
        "electronics_housings": 1,
        "local_displays": 1,
        "mounting_brackets": 1,
        "mounting_slot_through_holes": 4,
        "female_process_connection_recesses": 2,
        "fixed_blind_plugs": 1,
        "fluid_ports": 2,
        "high_pressure_ports": 1,
        "low_pressure_ports": 1,
        "cable_ports": 1,
        "port_surface_checks": 3,
        "port_axis_checks": 3,
        "embedded_animation_effects": 0,
        "embedded_animation_tracks": 0,
        "prohibited_external_components": 0,
    }
    actual_counts = {key: int(report.get(key, -1)) for key in expected_counts}
    dimensions = [float(value) for value in report.get("dimensions_m", [])]
    if (
        report.get("status") != "PASS"
        or actual_counts != expected_counts
        or int(report.get("runtime_bindings", -1)) != 16
        or float(report.get("port_surface_max_gap_m", 999.0)) > 0.005
        or float(report.get("port_axis_max_angle_deg", 999.0)) > 2.0
        or abs(float(report.get("hl_center_spacing_m", -1.0)) - 0.054) > 0.0005
        or float(report.get("hl_center_spacing_error_m", 999.0)) > 0.0005
        or float(report.get("hl_same_elevation_max_error_m", 999.0)) > 0.0005
        or report.get("embedded_animation_effect_counts") != {}
        or report.get("runtime_evidence_default") != "UNBOUND"
        or report.get("brand_marks") != "none"
        or report.get("plant_overview_integration")
        != "standalone_asset_not_installed_in_current_overview"
        or report.get("control_boundary")
        != "read_only_digital_twin_no_BA_or_PLC_write"
        or not 30_000 <= int(report.get("triangles_evaluated", -1)) <= 80_000
        or not 0 < int(report.get("glb_bytes", -1)) <= 3 * 1024 * 1024
        or len(dimensions) != 3
        or not 0.24 <= dimensions[0] <= 0.30
        or not 0.14 <= dimensions[1] <= 0.18
        or not 0.27 <= dimensions[2] <= 0.33
        or len(str(report.get("glb_sha256", ""))) != 64
        or len(str(report.get("blend_sha256", ""))) != 64
    ):
        raise RuntimeError(
            f"{label} differential-pressure transmitter contract failed: "
            f"counts={actual_counts}, report={report}"
        )
    return {
        "status": "PASS",
        "asset": report["asset"],
        "dimensions_m": report["dimensions_m"],
        "triangles": int(report["triangles_evaluated"]),
        "glb_bytes": int(report["glb_bytes"]),
        "glb_sha256": report["glb_sha256"],
        "blend_sha256": report["blend_sha256"],
        "runtime_bindings": int(report["runtime_bindings"]),
        "counts": actual_counts,
        "port_surface_max_gap_m": float(report["port_surface_max_gap_m"]),
        "port_axis_max_angle_deg": float(report["port_axis_max_angle_deg"]),
        "hl_center_spacing_m": float(report["hl_center_spacing_m"]),
        "hl_center_spacing_error_m": float(report["hl_center_spacing_error_m"]),
        "hl_same_elevation_max_error_m": float(
            report["hl_same_elevation_max_error_m"]
        ),
        "animation_effect_counts": report["embedded_animation_effect_counts"],
        "plant_overview_integration": report["plant_overview_integration"],
        "control_boundary": report["control_boundary"],
        "brand_marks": report["brand_marks"],
    }


def verify_truth(
    workspace: Path, mode: str, ffprobe: str, run_started_epoch: float
) -> dict[str, Any]:
    truth: dict[str, Any] = {"status": "PASS", "reports": {}}
    required_reports = {
        "full": tuple(REPORT_PATHS),
        "validate-only": (
            "source_generation", "glb_reimport", "lod1", "lod2", "orbit_render",
            "component_2d_render", "png_2d_provenance", "plant_2d_validation",
            "dosing_skid_generation", "dosing_skid_reimport",
            "water_makeup_generation", "water_makeup_reimport", "final_audit",
            "dp_transmitter_generation", "dp_transmitter_reimport",
            "dp_transmitter_inspection",
        ),
        "render-only": (
            "orbit_render", "component_2d_render", "png_2d_provenance",
            "plant_2d_validation", "dp_transmitter_inspection",
        ),
    }[mode]
    fresh_reports = {
        "full": set(required_reports),
        "validate-only": {
            "glb_reimport", "plant_2d_validation", "dosing_skid_reimport",
            "water_makeup_reimport", "dp_transmitter_reimport", "final_audit",
        },
        "render-only": {
            "orbit_render", "component_2d_render", "png_2d_provenance",
            "plant_2d_validation", "dp_transmitter_inspection",
        },
    }[mode]
    for label in required_reports:
        path = workspace / REPORT_PATHS[label]
        if not path.is_file():
            raise RuntimeError(f"Missing truth report: {path}")
        if label in fresh_reports and path.stat().st_mtime < run_started_epoch - 1.0:
            raise RuntimeError(f"Truth report was not refreshed by this run: {path}")
        report = load_json(path)
        if report.get("status") != "PASS":
            raise RuntimeError(f"Truth report is not PASS: {path}")
        truth["reports"][label] = str(path)
    if mode in {"full", "validate-only"}:
        source = load_json(workspace / REPORT_PATHS["source_generation"])
        reimport = load_json(workspace / REPORT_PATHS["glb_reimport"])
        truth["source_overview"] = verify_overview_counts(source, "source")
        truth["reimport_overview"] = verify_overview_counts(reimport, "reimport")
        truth["source_interfaces"] = verify_interface_report(source, "source")
        truth["reimport_interfaces"] = verify_interface_report(reimport, "reimport")
        truth["cooling_water_dosing_skid"] = {
            "source": verify_dosing_skid_report(
                load_json(workspace / REPORT_PATHS["dosing_skid_generation"]),
                "source",
            ),
            "reimport": verify_dosing_skid_report(
                load_json(workspace / REPORT_PATHS["dosing_skid_reimport"]),
                "reimport",
            ),
        }
        makeup_source = verify_water_makeup_skid_report(
            load_json(workspace / REPORT_PATHS["water_makeup_generation"]),
            "source",
        )
        makeup_reimport = verify_water_makeup_skid_report(
            load_json(workspace / REPORT_PATHS["water_makeup_reimport"]),
            "reimport",
        )
        for key in (
            "asset", "dimensions_m", "triangles", "glb_bytes",
            "glb_sha256", "blend_sha256", "runtime_bindings", "counts",
            "animation_effect_counts",
        ):
            if makeup_source.get(key) != makeup_reimport.get(key):
                raise RuntimeError(
                    f"Water-makeup source/reimport mismatch for {key}: "
                    f"source={makeup_source.get(key)!r}, "
                    f"reimport={makeup_reimport.get(key)!r}"
                )
        truth["pressurization_water_makeup_skid"] = {
            "source": makeup_source,
            "reimport": makeup_reimport,
        }
        dp_source = verify_dp_transmitter_report(
            load_json(workspace / REPORT_PATHS["dp_transmitter_generation"]),
            "source",
        )
        dp_reimport = verify_dp_transmitter_report(
            load_json(workspace / REPORT_PATHS["dp_transmitter_reimport"]),
            "reimport",
        )
        for key in (
            "asset", "dimensions_m", "triangles", "glb_bytes",
            "glb_sha256", "blend_sha256", "runtime_bindings", "counts",
            "port_surface_max_gap_m", "port_axis_max_angle_deg",
            "hl_center_spacing_m", "hl_center_spacing_error_m",
            "hl_same_elevation_max_error_m", "animation_effect_counts",
        ):
            if dp_source.get(key) != dp_reimport.get(key):
                raise RuntimeError(
                    f"Differential-pressure source/reimport mismatch for {key}: "
                    f"source={dp_source.get(key)!r}, "
                    f"reimport={dp_reimport.get(key)!r}"
                )
        truth["differential_pressure_transmitter"] = {
            "source": dp_source,
            "reimport": dp_reimport,
        }
        truth["lod"] = {"LOD0": verify_lod_budget("LOD0", reimport)}
        for label in ("lod1", "lod2"):
            report = load_json(workspace / REPORT_PATHS[label])
            level = label.upper()
            if (
                report.get("mesh_post_validation") != "PASS"
                or report.get("interface_validation_status") != "PASS"
                or float(report.get("interface_max_gap_m", 999.0))
                > INTERFACE_TOLERANCE_M
                or report.get("pipe_clearance_validation_status") != "PASS"
                or int(report.get("pipe_clearance_checks", -1))
                != EXPECTED_PIPE_CLEARANCE_CHECKS
                or int(report.get("pipe_clearance_violations", -1)) != 0
                or float(report.get("pipe_clearance_min_surface_gap_m", -1.0))
                < PIPE_CLEARANCE_MARGIN_M
                or report.get("pump_bypass_clearance_validation_status") != "PASS"
                or int(report.get("pump_bypass_clearance_checks", -1))
                != EXPECTED_PUMP_BYPASS_CLEARANCE_CHECKS
                or int(report.get("pump_bypass_clearance_violations", -1)) != 0
                or float(report.get("pump_bypass_min_surface_gap_m", -1.0))
                < PUMP_BYPASS_REQUIRED_SURFACE_GAP_M
                or report.get("manifold_port_alignment_status") != "PASS"
                or int(report.get("manifold_port_axis_checks", -1))
                != EXPECTED_MANIFOLD_PORT_AXIS_CHECKS
                or float(report.get("manifold_port_max_axis_angle_deg", 999.0))
                > MANIFOLD_PORT_AXIS_TOLERANCE_DEG
                or int(report.get("embedded_animation_effects", -1))
                != EXPECTED_EMBEDDED_ANIMATION_EFFECTS
                or int(report.get("embedded_animation_tracks", -1))
                != EXPECTED_EMBEDDED_ANIMATION_EFFECTS
                or report.get("embedded_animation_effect_counts")
                != EXPECTED_ANIMATION_EFFECT_COUNTS
                or int(report.get("flow_surface_segments", -1)) != 16
                or int(report.get("flow_ring_objects", -1)) != 0
                or int(report.get("pump_rotation_markers", -1))
                != EXPECTED_PUMP_ROTATION_MARKERS
            ):
                raise RuntimeError(f"{label} validation contract failed")
            truth["lod"][level] = verify_lod_budget(level, report)
        truth["final_audit"] = load_json(workspace / REPORT_PATHS["final_audit"])
    plant_2d = load_json(workspace / REPORT_PATHS["plant_2d_validation"])
    if (
        plant_2d.get("status") != "PASS"
        or plant_2d.get("topology", {}).get("closedLoadLoops") != 4
        or float(plant_2d.get("topology", {}).get("maxPortGapPx", 999.0)) > 1.0
        or plant_2d.get("counts", {}).get("processPortAnchors")
        != EXPECTED_PROCESS_PORT_ANCHORS
        or plant_2d.get("counts", {}).get("pointBindings")
        != EXPECTED_2D_POINT_BINDINGS
        or plant_2d.get("counts", {}).get("flowEdges")
        != EXPECTED_2D_FLOW_EDGES
        or len(plant_2d.get("topology", {}).get("declaredCrossovers", []))
        != EXPECTED_2D_DECLARED_CROSSOVERS
        or plant_2d.get("activeDuplicateAssets")
    ):
        raise RuntimeError("2D plant validation contract failed")
    truth["plant_2d"] = {
        "status": "PASS",
        "report": str(workspace / REPORT_PATHS["plant_2d_validation"]),
        "closed_load_loops": 4,
        "process_port_anchors": EXPECTED_PROCESS_PORT_ANCHORS,
        "point_bindings": EXPECTED_2D_POINT_BINDINGS,
        "flow_edges": EXPECTED_2D_FLOW_EDGES,
        "declared_crossovers": EXPECTED_2D_DECLARED_CROSSOVERS,
        "max_port_gap_px": plant_2d["topology"]["maxPortGapPx"],
    }
    truth["b25_binding"] = verify_b25_binding_contract(workspace)
    truth["gif"] = probe_gif(workspace, ffprobe)
    conflicts = find_conflicts(workspace)
    if conflicts:
        raise RuntimeError(f"Postflight duplicate or backup files: {conflicts}")
    truth["postflight_conflicts"] = []
    artifact_paths = {
        "blend": OVERVIEW_BLEND,
        "glb_lod0": (
            "apps/chiller-shell-v1/public/models/plant-overview/"
            "chilled-water-plant-overview-latest-v2.glb"
        ),
        "glb_lod1": (
            "apps/chiller-shell-v1/public/models/plant-overview/lod/"
            "chilled-water-plant-overview-latest-v2-lod1.glb"
        ),
        "glb_lod2": (
            "apps/chiller-shell-v1/public/models/plant-overview/lod/"
            "chilled-water-plant-overview-latest-v2-lod2.glb"
        ),
        "preview": "output/blender/chilled-water-plant-overview-latest-v2-preview.png",
        "gif": GIF_PATH,
        "svg_2d": (
            "apps/chiller-shell-v1/public/models/plant-overview/2d/"
            "chilled-water-plant-overview-latest-v2.svg"
        ),
        "png_2d": "output/blender/chilled-water-plant-overview-latest-v2-2d.png",
        "point_contract_2d": (
            "apps/chiller-shell-v1/public/models/plant-overview/2d/"
            "chilled-water-plant-overview-latest-v2-point-bindings.json"
        ),
        "port_contract_2d": (
            "apps/chiller-shell-v1/public/models/plant-overview/2d/"
            "chilled-water-plant-overview-latest-v2-port-anchors.json"
        ),
        "dosing_skid_blend": (
            "apps/chiller-shell-v1/public/models/cooling-water-dosing-skid/"
            "source/blender/cooling-water-automatic-dosing-skid-generic-v1.blend"
        ),
        "dosing_skid_glb": (
            "apps/chiller-shell-v1/public/models/cooling-water-dosing-skid/"
            "cooling-water-automatic-dosing-skid-generic-v1.glb"
        ),
        "dosing_skid_preview": (
            "output/blender/cooling-water-automatic-dosing-skid-generic-v1-preview.png"
        ),
        "water_makeup_skid_blend": (
            "apps/chiller-shell-v1/public/models/pressurization-water-makeup-skid/"
            "source/blender/pressurization-water-makeup-skid-generic-v1.blend"
        ),
        "water_makeup_skid_glb": (
            "apps/chiller-shell-v1/public/models/pressurization-water-makeup-skid/"
            "pressurization-water-makeup-skid-generic-v1.glb"
        ),
        "water_makeup_skid_preview": (
            "output/blender/pressurization-water-makeup-skid-generic-v1-preview.png"
        ),
        "dp_transmitter_blend": (
            "apps/chiller-shell-v1/public/models/differential-pressure-transmitter/"
            "source/blender/differential-pressure-transmitter-wet-wet-generic-v1.blend"
        ),
        "dp_transmitter_glb": (
            "apps/chiller-shell-v1/public/models/differential-pressure-transmitter/"
            "differential-pressure-transmitter-wet-wet-generic-v1.glb"
        ),
        "dp_transmitter_preview": (
            "output/blender/differential-pressure-transmitter-wet-wet-generic-v1-preview.png"
        ),
        "dp_transmitter_front_lower": (
            "output/blender/differential-pressure-transmitter-wet-wet-generic-v1-inspection/"
            "front_lower.png"
        ),
    }
    truth["artifact_sizes_bytes"] = {
        label: (workspace / relative).stat().st_size
        for label, relative in artifact_paths.items()
        if (workspace / relative).is_file()
    }
    return truth


def write_summary(workspace: Path, summary: dict[str, Any]) -> Path:
    run_dir = workspace / "output/blender/skill-runs"
    run_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%dT%H%M%S-%f")
    path = run_dir / f"blender-chilled-water-plant-{stamp}.json"
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def main() -> int:
    args = parse_args()
    workspace = args.workspace.expanduser().resolve()
    run_started_epoch = time.time()
    started_at = utc_now()
    preflight_report = preflight(workspace)
    commands = stage_commands(workspace, preflight_report["binaries"], args.mode)
    summary: dict[str, Any] = {
        "skill": "blender-chilled-water-plant",
        "mode": args.mode,
        "dry_run": args.dry_run,
        "workspace": str(workspace),
        "started_at": started_at,
        "preflight": preflight_report,
        "planned_commands": [
            {"name": name, "command": command} for name, command in commands
        ],
        "stages": [],
    }
    if args.dry_run:
        summary["status"] = (
            "DRY_RUN_PASS"
            if preflight_report["status"] == "PASS"
            else "DRY_RUN_BLOCKED"
        )
        summary["finished_at"] = utc_now()
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0 if preflight_report["status"] == "PASS" else 2
    if preflight_report["status"] != "PASS":
        summary["status"] = "BLOCKED"
        summary["finished_at"] = utc_now()
        summary_path = write_summary(workspace, summary)
        print(json.dumps({**summary, "summary_path": str(summary_path)}, ensure_ascii=False, indent=2))
        return 2

    environment = os.environ.copy()
    environment["CHILLED_WATER_PLANT_WORKSPACE"] = str(workspace)
    for name, command in commands:
        result = run_stage(name, command, workspace, environment)
        summary["stages"].append(result)
        if result["status"] != "PASS":
            summary["status"] = "FAIL"
            summary["failed_stage"] = name
            break
    else:
        try:
            summary["truth"] = verify_truth(
                workspace,
                args.mode,
                str(preflight_report["binaries"]["ffprobe"]),
                run_started_epoch,
            )
            summary["status"] = "PASS"
        except Exception as error:
            summary["status"] = "FAIL"
            summary["truth_error"] = str(error)
    summary["finished_at"] = utc_now()
    summary_path = write_summary(workspace, summary)
    print(json.dumps({**summary, "summary_path": str(summary_path)}, ensure_ascii=False, indent=2))
    return 0 if summary["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
