"""Truncate all application tables (keeps schema and alembic_version)."""

from sqlalchemy import create_engine, text

from backend.app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    engine = create_engine(settings.database_url)
    with engine.begin() as conn:
        tables = conn.execute(
            text(
                """
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' AND tablename != 'alembic_version'
                ORDER BY tablename
                """
            )
        ).scalars().all()
        if not tables:
            print("No tables found")
            return
        quoted = ", ".join(f'"{t}"' for t in tables)
        conn.execute(text(f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"))
        print(f"Truncated {len(tables)} tables:")
        for table in tables:
            print(f"  - {table}")


if __name__ == "__main__":
    main()
