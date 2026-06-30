from pydantic import BaseModel, Field


class DeviceTokenRegisterRequest(BaseModel):
    token: str = Field(min_length=8, max_length=255)
    platform: str = Field(default="unknown", min_length=2, max_length=32)


class DeviceTokenResponse(BaseModel):
    registered: bool

