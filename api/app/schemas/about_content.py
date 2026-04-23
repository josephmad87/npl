from datetime import datetime

from pydantic import BaseModel, Field


class AboutContacts(BaseModel):
    emails: list[str] = Field(default_factory=list)
    phone: str = ""


class AboutTeamMember(BaseModel):
    position: str = ""
    picture_url: str = ""


class AboutContentBody(BaseModel):
    mission: str = ""
    vision: str = ""
    history: str = ""
    team: list[AboutTeamMember] = Field(default_factory=list)
    contacts: AboutContacts = Field(default_factory=AboutContacts)
    physical_address: str = ""


class AboutContentOut(AboutContentBody):
    updated_at: datetime
