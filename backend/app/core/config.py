from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("backend/.env", ".env"), extra="ignore")

    app_name: str = Field(default="Daxch API", alias="APP_NAME")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")
    frontend_base_url: str = Field(default="http://localhost:3000", alias="FRONTEND_BASE_URL")

    secret_key: str = Field(alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(default=1440, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    magic_link_expire_minutes: int = Field(default=10, alias="MAGIC_LINK_EXPIRE_MINUTES")

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")
    celery_broker_url: str = Field(alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(alias="CELERY_RESULT_BACKEND")

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")

    news_api_key: str = Field(default="", alias="NEWS_API_KEY")
    tavily_api_key: str = Field(default="", alias="TAVILY_API_KEY")
    eodhd_api_key: str = Field(default="", alias="EODHD_API_KEY")

    upstox_client_id: str = Field(default="", alias="UPSTOX_CLIENT_ID")
    upstox_client_secret: str = Field(default="", alias="UPSTOX_CLIENT_SECRET")
    upstox_redirect_uri: str = Field(default="", alias="UPSTOX_REDIRECT_URI")
    upstox_base_url: str = Field(default="https://api.upstox.com/v2", alias="UPSTOX_BASE_URL")

    fivepaisa_app_key: str = Field(default="", alias="FIVEPAISA_APP_KEY")
    fivepaisa_encryption_key: str = Field(default="", alias="FIVEPAISA_ENCRYPTION_KEY")
    fivepaisa_user_id: str = Field(default="", alias="FIVEPAISA_USER_ID")
    fivepaisa_redirect_uri: str = Field(default="", alias="FIVEPAISA_REDIRECT_URI")
    fivepaisa_login_url: str = Field(
        default="https://openapi.5paisa.com/WebVendorLogin/VLogin/Index",
        alias="FIVEPAISA_LOGIN_URL",
    )
    fivepaisa_api_url: str = Field(
        default="https://Openapi.5paisa.com/VendorsAPI/Service1.svc",
        alias="FIVEPAISA_API_URL",
    )
    fivepaisa_market_url: str = Field(default="https://openapi.5paisa.com/V2", alias="FIVEPAISA_MARKET_URL")
    fivepaisa_algo_id: str = Field(default="0", alias="FIVEPAISA_ALGO_ID")

    razorpay_key_id: str = Field(default="", alias="RAZORPAY_KEY_ID")
    razorpay_key_secret: str = Field(default="", alias="RAZORPAY_KEY_SECRET")
    razorpay_webhook_secret: str = Field(default="", alias="RAZORPAY_WEBHOOK_SECRET")
    razorpay_plan_starter_id: str = Field(default="", alias="RAZORPAY_PLAN_STARTER_ID")
    razorpay_plan_pro_id: str = Field(default="", alias="RAZORPAY_PLAN_PRO_ID")
    razorpay_plan_ultra_id: str = Field(default="", alias="RAZORPAY_PLAN_ULTRA_ID")

    aws_region: str = Field(default="ap-south-1", alias="AWS_REGION")
    ses_from_email: str = Field(default="", alias="SES_FROM_EMAIL")

    fcm_credentials_json: str = Field(default="", alias="FCM_CREDENTIALS_JSON")
    fernet_key: str = Field(default="", alias="FERNET_KEY")

    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(default="", alias="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(default="", alias="GOOGLE_REDIRECT_URI")

    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    enable_demo_mode: bool = Field(default=True, alias="ENABLE_DEMO_MODE")
    admin_emails: str = Field(default="", alias="ADMIN_EMAILS")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    @property
    def admin_emails_list(self) -> list[str]:
        return [email.strip().lower() for email in self.admin_emails.split(",") if email.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_requirements(self) -> "Settings":
        if not self.is_production:
            return self

        required_values: dict[str, str] = {
            "SECRET_KEY": self.secret_key,
            "FRONTEND_BASE_URL": self.frontend_base_url,
            "CORS_ORIGINS": self.cors_origins,
            "OPENAI_API_KEY": self.openai_api_key,
            "UPSTOX_CLIENT_ID": self.upstox_client_id,
            "UPSTOX_CLIENT_SECRET": self.upstox_client_secret,
            "UPSTOX_REDIRECT_URI": self.upstox_redirect_uri,
            "RAZORPAY_KEY_ID": self.razorpay_key_id,
            "RAZORPAY_KEY_SECRET": self.razorpay_key_secret,
            "RAZORPAY_WEBHOOK_SECRET": self.razorpay_webhook_secret,
            "RAZORPAY_PLAN_STARTER_ID": self.razorpay_plan_starter_id,
            "RAZORPAY_PLAN_PRO_ID": self.razorpay_plan_pro_id,
            "RAZORPAY_PLAN_ULTRA_ID": self.razorpay_plan_ultra_id,
            "SES_FROM_EMAIL": self.ses_from_email,
            "FCM_CREDENTIALS_JSON": self.fcm_credentials_json,
            "FERNET_KEY": self.fernet_key,
        }
        missing = [key for key, value in required_values.items() if not value]
        if missing:
            raise ValueError(f"Missing required production env vars: {', '.join(missing)}")
        if self.debug:
            raise ValueError("DEBUG must be false in production.")
        if self.secret_key.strip().lower() == "change-this-in-production" or len(self.secret_key.strip()) < 32:
            raise ValueError("SECRET_KEY must be a secure random value (minimum 32 characters).")
        if self.enable_demo_mode:
            raise ValueError("ENABLE_DEMO_MODE must be false in production.")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

