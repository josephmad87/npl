from datetime import datetime

from pydantic import BaseModel, Field


class MerchandiseProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    price_text: str = Field(default="", max_length=64)
    image_url: str = Field(default="", max_length=1024)
    sizes_text: str | None = Field(default=None, max_length=255)
    status: str = Field(default="active", max_length=32)
    sort_order: int = 0


class MerchandiseProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price_text: str | None = Field(default=None, max_length=64)
    image_url: str | None = Field(default=None, max_length=1024)
    sizes_text: str | None = Field(default=None, max_length=255)
    status: str | None = Field(default=None, max_length=32)
    sort_order: int | None = None


class MerchandiseProductOut(BaseModel):
    id: int
    name: str
    description: str | None
    price_text: str
    image_url: str
    sizes_text: str | None
    status: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MerchandiseOrderCreate(BaseModel):
    product_id: int
    customer_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    size: str | None = Field(default=None, max_length=64)
    quantity: int = Field(default=1, ge=1, le=99)
    notes: str | None = None


class MerchandiseOrderUpdate(BaseModel):
    status: str | None = Field(default=None, max_length=32)


class MerchandiseOrderOut(BaseModel):
    id: int
    product_id: int | None
    product_name: str
    customer_name: str
    phone: str
    email: str | None
    size: str | None
    quantity: int
    notes: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
