#!/usr/bin/env python3
"""生成 Maple Mono NL CN 的按需加载字体分片与对应 CSS。"""

from __future__ import annotations

import argparse
import os
import tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
except ImportError as error:
    raise SystemExit("请先安装 fonttools[woff]：python -m pip install 'fonttools[woff]'") from error


FONT_FAMILY = "Maple Mono NL CN Extended"
FILE_PREFIX = "MapleMonoNL-CN-Extended"
DEFAULT_BLOCK_SIZE = 0x100


@dataclass(frozen=True)
class ShardJob:
    """描述一个字体分片生成任务。"""

    source: Path
    output: Path
    codepoints: tuple[int, ...]


def parse_args() -> argparse.Namespace:
    """读取命令行参数。"""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--regular", required=True, type=Path, help="完整 Regular TTF 路径")
    parser.add_argument("--medium", required=True, type=Path, help="完整 Medium TTF 路径")
    parser.add_argument("--core-regular", required=True, type=Path, help="核心 Regular WOFF2 路径")
    parser.add_argument("--core-medium", required=True, type=Path, help="核心 Medium WOFF2 路径")
    parser.add_argument("--output-dir", required=True, type=Path, help="字体分片输出目录")
    parser.add_argument("--css-output", required=True, type=Path, help="生成的 CSS 文件路径")
    parser.add_argument(
        "--block-size",
        type=lambda value: int(value, 0),
        default=DEFAULT_BLOCK_SIZE,
        help="Unicode 分片大小，默认 0x100",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=max(1, min(4, os.cpu_count() or 1)),
        help="并行任务数，默认不超过 4",
    )
    return parser.parse_args()


def read_codepoints(font_path: Path) -> set[int]:
    """读取字体最佳 cmap 中的全部 Unicode 码位。"""

    with TTFont(font_path, lazy=True) as font:
        cmap = font.getBestCmap()
        if not cmap:
            raise ValueError(f"字体缺少可用 cmap：{font_path}")
        return set(cmap)


def group_codepoints(codepoints: set[int], block_size: int) -> list[tuple[int, tuple[int, ...]]]:
    """按照固定 Unicode 区间整理码位。"""

    groups: dict[int, list[int]] = {}
    for codepoint in sorted(codepoints):
        start = codepoint - codepoint % block_size
        groups.setdefault(start, []).append(codepoint)
    return [(start, tuple(points)) for start, points in sorted(groups.items())]


def build_shard(job: ShardJob) -> tuple[str, int]:
    """生成单个 WOFF2 分片并返回文件名与大小。"""

    options = subset.Options()
    options.flavor = "woff2"
    options.hinting = False
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    options.name_languages = [0x0409, 0x0804]
    options.name_legacy = False
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recommended_glyphs = True
    options.recalc_bounds = True
    options.recalc_timestamp = False
    options.canonical_order = True
    if "meta" not in options.drop_tables:
        options.drop_tables.append("meta")

    font = subset.load_font(str(job.source), options, lazy=False)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=job.codepoints)
    subsetter.subset(font)
    subset.save_font(font, str(job.output), options)
    return job.output.name, job.output.stat().st_size


def css_face(file_name: str, weight: int, start: int, end: int, relative_dir: str) -> str:
    """生成单个字体分片的 @font-face 规则。"""

    font_url = f"{relative_dir}/{file_name}" if relative_dir != "." else file_name
    return (
        "@font-face {\n"
        f"    font-family: '{FONT_FAMILY}';\n"
        f"    src: url('{font_url}') format('woff2');\n"
        "    font-style: normal;\n"
        f"    font-weight: {weight};\n"
        "    font-display: swap;\n"
        f"    unicode-range: U+{start:04X}-{end:04X};\n"
        "}\n"
    )


def main() -> None:
    """校验输入、生成全部分片，并在成功后替换旧产物。"""

    args = parse_args()
    if args.block_size <= 0 or args.block_size & (args.block_size - 1):
        raise SystemExit("--block-size 必须是大于零的 2 的幂")
    if args.workers <= 0:
        raise SystemExit("--workers 必须大于零")

    font_inputs = {
        "Regular": (args.regular.resolve(), args.core_regular.resolve(), 400),
        "Medium": (args.medium.resolve(), args.core_medium.resolve(), 500),
    }
    for source, core, _weight in font_inputs.values():
        if not source.is_file() or not core.is_file():
            raise SystemExit(f"字体输入不存在：{source} 或 {core}")

    output_dir = args.output_dir.resolve()
    css_output = args.css_output.resolve()
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    css_output.parent.mkdir(parents=True, exist_ok=True)

    css_relative_dir = Path(os.path.relpath(output_dir, css_output.parent)).as_posix()
    css_rules = ["/** Maple Mono NL CN V7.9 按 Unicode 区间离线加载。 */\n"]
    total_bytes = 0
    total_files = 0

    with tempfile.TemporaryDirectory(prefix="maple-shards-", dir=output_dir.parent) as temp_name:
        temp_dir = Path(temp_name)
        jobs: list[ShardJob] = []
        metadata: dict[str, tuple[int, int, int]] = {}

        for label, (source, core, weight) in font_inputs.items():
            missing = read_codepoints(source) - read_codepoints(core)
            for start, points in group_codepoints(missing, args.block_size):
                end = start + args.block_size - 1
                file_name = f"{FILE_PREFIX}-{label}-u{start:04x}-{end:04x}.woff2"
                jobs.append(ShardJob(source, temp_dir / file_name, points))
                metadata[file_name] = (weight, start, end)

        print(f"计划生成 {len(jobs)} 个字体分片")
        with ProcessPoolExecutor(max_workers=args.workers) as executor:
            futures = {executor.submit(build_shard, job): job for job in jobs}
            for completed, future in enumerate(as_completed(futures), start=1):
                file_name, file_size = future.result()
                total_bytes += file_size
                total_files += 1
                if completed % 20 == 0 or completed == len(jobs):
                    print(f"已生成 {completed}/{len(jobs)} 个字体分片")

        for file_name, (weight, start, end) in sorted(
            metadata.items(), key=lambda item: (item[1][0], item[1][1])
        ):
            css_rules.append(css_face(file_name, weight, start, end, css_relative_dir))

        output_dir.mkdir(parents=True, exist_ok=True)
        for existing in output_dir.glob(f"{FILE_PREFIX}-*.woff2"):
            existing.unlink()
        for generated in temp_dir.iterdir():
            generated.replace(output_dir / generated.name)

    css_output.write_text("\n".join(css_rules), encoding="utf-8", newline="\n")
    print(f"完成：{total_files} 个分片，共 {total_bytes} 字节")
    print(f"CSS：{css_output}")


if __name__ == "__main__":
    main()
