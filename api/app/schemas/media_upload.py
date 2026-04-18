from pydantic import BaseModel, Field


class MediaUploadOut(BaseModel):
    """Response from POST /admin/uploads."""

    url: str = Field(min_length=1, description="Absolute URL clients can store in *_url fields")
    path: str = Field(min_length=1, description="Storage path relative to the media static root")
