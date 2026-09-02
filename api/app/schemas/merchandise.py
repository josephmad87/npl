from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator


class MerchandiseProductVariantIn(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=128)
    size: str | None = Field(default=None, max_length=64)
    colour: str | None = Field(default=None, max_length=64)
    price_text: str = Field(default="", max_length=64)
    price_minor: int | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    stock_quantity: int | None = Field(default=None, ge=0)
    allow_backorder: bool = False
    status: str = Field(default="active", pattern="^(active|inactive)$")
    sort_order: int = 0


class MerchandiseProductVariantOut(MerchandiseProductVariantIn):
    id: int
    product_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MerchandiseProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    price_text: str = Field(default="", max_length=64)
    image_url: str = Field(default="", max_length=1024)
    image_url_2: str = ""
    image_url_3: str = ""
    sizes_text: str | None = Field(default=None, max_length=255)
    status: str = Field(default="active", max_length=32)
    category: str = Field(default="Other", max_length=64)
    audience: str = Field(default="Unisex", max_length=64)
    team_id: int | None = None
    team_ids: list[int] = Field(default_factory=list)
    sort_order: int = 0
    variants: list[MerchandiseProductVariantIn] = Field(default_factory=list, max_length=100)


class MerchandiseProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    price_text: str | None = Field(default=None, max_length=64)
    image_url: str | None = Field(default=None, max_length=1024)
    image_url_2: str | None = None
    image_url_3: str | None = None
    sizes_text: str | None = Field(default=None, max_length=255)
    status: str | None = Field(default=None, max_length=32)
    category: str | None = Field(default=None, max_length=64)
    audience: str | None = Field(default=None, max_length=64)
    team_id: int | None = None
    team_ids: list[int] | None = None
    sort_order: int | None = None
    variants: list[MerchandiseProductVariantIn] | None = Field(default=None, max_length=100)


class MerchandiseProductOut(BaseModel):
    id: int
    name: str
    description: str | None
    price_text: str
    image_url: str
    image_url_2: str
    image_url_3: str
    sizes_text: str | None
    category: str
    audience: str
    team_id: int | None
    team_ids: list[int] = Field(default_factory=list)
    status: str
    sort_order: int
    created_at: datetime
    updated_at: datetime
    variants: list[MerchandiseProductVariantOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class MerchandiseOrderCreate(BaseModel):
    product_id: int
    variant_id: int | None = None
    customer_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    size: str | None = Field(default=None, max_length=64)
    quantity: int = Field(default=1, ge=1, le=99)
    notes: str | None = Field(default=None, max_length=2000)
    fulfilment_method: str = Field(default="collection", pattern="^(collection|delivery)$")
    delivery_address: str | None = Field(default=None, max_length=1000)
    website: str | None = Field(default=None, max_length=255, description="Honeypot field; must be empty")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        trimmed = value.strip()
        if "@" not in trimmed or trimmed.startswith("@") or trimmed.endswith("@"):
            raise ValueError("Invalid email address")
        return trimmed

    @field_validator("website")
    @classmethod
    def honeypot_empty(cls, value: str | None) -> str | None:
        if value and value.strip():
            raise ValueError("Invalid submission")
        return value

    @model_validator(mode="after")
    def delivery_requires_address(self) -> "MerchandiseOrderCreate":
        if self.fulfilment_method == "delivery" and not (self.delivery_address or "").strip():
            raise ValueError("A delivery address is required for delivery orders.")
        return self


class MerchandiseOrderCreateOut(BaseModel):
    id: int
    order_number: str
    tracking_token: str
    status: str
    created_at: datetime


class MerchandiseOrderUpdate(BaseModel):
    status: str | None = Field(
        default=None,
        pattern="^(new|confirmed|preparing|ready_for_collection|dispatched|fulfilled|cancelled)$",
    )
    payment_status: str | None = Field(default=None, pattern="^(pending|paid|refunded|failed)$")
    fulfilment_method: str | None = Field(default=None, pattern="^(collection|delivery)$")
    fulfilment_notes: str | None = Field(default=None, max_length=2000)
    delivery_address: str | None = Field(default=None, max_length=1000)
    carrier: str | None = Field(default=None, max_length=128)
    tracking_number: str | None = Field(default=None, max_length=255)
    estimated_ready_at: datetime | None = None
    public_message: str | None = Field(default=None, max_length=2000)


class MerchandiseOrderOut(BaseModel):
    id: int
    product_id: int | None
    supporter_id: int | None
    variant_id: int | None
    order_number: str
    product_name: str
    customer_name: str
    phone: str
    email: str | None
    size: str | None
    quantity: int
    notes: str | None
    status: str
    payment_status: str
    fulfilment_method: str
    fulfilment_notes: str | None
    delivery_address: str | None
    carrier: str | None
    tracking_number: str | None
    estimated_ready_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MerchandiseOrderStatusEventOut(BaseModel):
    status: str
    public_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MerchandiseOrderTrackingOut(BaseModel):
    order_number: str
    product_name: str
    variant_label: str | None
    quantity: int
    status: str
    payment_status: str
    fulfilment_method: str
    fulfilment_notes: str | None
    carrier: str | None
    tracking_number: str | None
    estimated_ready_at: datetime | None
    created_at: datetime
    updated_at: datetime
    timeline: list[MerchandiseOrderStatusEventOut] = Field(default_factory=list)
