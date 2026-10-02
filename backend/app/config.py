from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str = ""
    github_username: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:5173/auth/callback"
    frontend_origin: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
