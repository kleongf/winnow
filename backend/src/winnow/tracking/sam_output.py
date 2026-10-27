"""Turn SAM 3.1's streamed text into per-frame boxes, via Meta's own parser."""

from dataclasses import dataclass

from meta_sam_parser import SegmentationBoxRecord, video_segmentation_format


@dataclass(frozen=True)
class TrackedBox:
    frame: int
    object_id: str
    left: float
    top: float
    right: float
    bottom: float
    confidence: float | None

    @property
    def center(self) -> tuple[float, float]:
        return ((self.left + self.right) / 2, (self.top + self.bottom) / 2)


def parse_boxes(text: str) -> list[TrackedBox]:
    parser = video_segmentation_format().create_parser()
    snapshots = parser.push(text if text.endswith("\n") else text + "\n")
    if not snapshots:
        return []
    return [
        TrackedBox(
            frame=record.frame.frame_index if record.frame else 0,
            object_id=record.object_id,
            left=record.left,
            top=record.top,
            right=record.right,
            bottom=record.bottom,
            confidence=record.confidence,
        )
        for record in snapshots[-1].records
        if isinstance(record, SegmentationBoxRecord)
    ]
