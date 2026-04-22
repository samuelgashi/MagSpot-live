import psycopg2
import psycopg2.extras
from ..config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from cryptography.fernet import Fernet
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def ensure_database_exists():
    """
    Connect to the default 'postgres' database and create
    POSTGRES_DB if it does not exist.
    """
    # Connect to default DB first
    conn = psycopg2.connect(
        host=Config.POSTGRES_HOST,
        port=Config.POSTGRES_PORT,
        dbname="postgres",
        user=Config.POSTGRES_USER,
        password=Config.POSTGRES_PASSWORD,
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM pg_database WHERE datname = %s;", (Config.POSTGRES_DB,)
    )
    exists = cur.fetchone()
    if not exists:
        print(f"Database '{Config.POSTGRES_DB}' does not exist. Creating it...")
        cur.execute(f"CREATE DATABASE {Config.POSTGRES_DB};")
        print(f"Database '{Config.POSTGRES_DB}' created.")
    else: print(f"Database '{Config.POSTGRES_DB}' already exists.")
    cur.close()
    conn.close()


def run_migrations():
    """Run database migrations for S/N support"""
    print("Running database migrations...")
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'Group_Devices' AND column_name = 'serial_number'
            """))
            
            if not result.fetchone():
                conn.execute(text("""ALTER TABLE "Group_Devices" ADD COLUMN serial_number VARCHAR"""))
                conn.execute(text("""UPDATE "Group_Devices" SET serial_number = ip_address"""))
                conn.execute(text('ALTER TABLE "Group_Devices" DROP COLUMN ip_address'))
            else: pass
            
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'Group_Devices' AND column_name = 'id'
            """))
            
            if not result.fetchone():
                print("Restoring id column in Group_Devices...")
                conn.execute(text("""ALTER TABLE "Group_Devices" ADD COLUMN id VARCHAR"""))
                conn.execute(text("""
                    UPDATE "Group_Devices" SET id = gen_random_uuid() WHERE id IS NULL
                """))
            else: pass
            
            result = conn.execute(text("""
                SELECT a.attname AS column_name
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = '"Group_Devices"'::regclass
                AND i.indisprimary
            """))
            pk_columns = [row[0] for row in result.fetchall()]
            if 'id' not in pk_columns:
                conn.execute(text('ALTER TABLE "Group_Devices" DROP CONSTRAINT IF EXISTS "Group_Devices_pkey"'))
                conn.execute(text('ALTER TABLE "Group_Devices" DROP CONSTRAINT IF EXISTS Group_Devices_pkey'))
                conn.execute(text('ALTER TABLE "Group_Devices" ADD PRIMARY KEY (id)'))
            else: pass
            
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'Android_Devices' AND column_name = 'serial_number'
            """))
            if not result.fetchone():
                conn.execute(text("""ALTER TABLE "Android_Devices" ADD COLUMN serial_number VARCHAR"""))

            for col, coltype in [
                ("model", "VARCHAR(255)"),
                ("android_version", "VARCHAR(50)"),
                ("battery_level", "VARCHAR(10)"),
                ("sheet_url", "TEXT"),
            ]:
                result = conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'Android_Devices' AND column_name = '{col}'
                """))
                if not result.fetchone():
                    conn.execute(text(f'ALTER TABLE "Android_Devices" ADD COLUMN {col} {coltype}'))

            for col, coltype in [
                ("description", "TEXT"),
                ("color", "VARCHAR(50)"),
            ]:
                result = conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'Device_Groups' AND column_name = '{col}'
                """))
                if not result.fetchone():
                    conn.execute(text(f'ALTER TABLE "Device_Groups" ADD COLUMN {col} {coltype}'))

            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'Users' AND column_name = 'password_hash'
            """))
            if not result.fetchone():
                conn.execute(text('ALTER TABLE "Users" ADD COLUMN password_hash VARCHAR'))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS "Task_Templates" (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR NOT NULL REFERENCES "Users"(user_id) ON DELETE CASCADE,
                    name VARCHAR NOT NULL,
                    description TEXT,
                    type VARCHAR DEFAULT 'custom',
                    script_ref VARCHAR,
                    duration_min INTEGER DEFAULT 30,
                    duration_max INTEGER DEFAULT 120,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))

            trans.commit()
            print("All migrations completed successfully!")
            
        except Exception as e:
            trans.rollback()
            print(f"Migration failed: {e}")
            raise



DATABASE_URL = Config.SQLALCHEMY_DATABASE_URI
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# Run migrations on module import
# ensure_database_exists()
# run_migrations()
