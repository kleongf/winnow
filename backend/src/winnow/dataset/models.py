from pydantic import BaseModel


class SourceCount(BaseModel):
    name: str
    episodes: int


class DatasetStatus(BaseModel):
    """Description-independent work on the Dataset so far, for the Prepare page."""

    name: str
    sources: list[SourceCount]
    episodes: int  # ingested: robot data plus H.264 and 5 fps clips for every camera
    boxes: int  # Episodes with a hand-drawn box
    baseline: int | None  # Episodes with a complete Spark-alone baseline; None without Meta
    cost_usd: float  # Meta API spend so far
