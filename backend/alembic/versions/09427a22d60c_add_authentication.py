"""add authentication

Revision ID: 09427a22d60c
Revises: e6e55a2caf26
Create Date: 2026-11-11 19:36:05.407989
"""
from alembic import op
import sqlalchemy as sa

from app.core.config import settings
from app.core.security import hash_password


revision = '09427a22d60c'
down_revision = 'e6e55a2caf26'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('password_hash', sa.String(length=200), nullable=True))
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'auth_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('csrf_token', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash'),
    )
    op.create_index('ix_auth_sessions_user_id', 'auth_sessions', ['user_id'], unique=False)

    if settings.seed_demo_users:
        bind = op.get_bind()
        rows = bind.execute(sa.text("SELECT id FROM users WHERE password_hash IS NULL")).fetchall()
        for row in rows:
            bind.execute(
                sa.text("UPDATE users SET password_hash = :password WHERE id = :id"),
                {"password": hash_password(settings.demo_password), "id": row[0]},
            )


def downgrade() -> None:
    op.drop_index('ix_auth_sessions_user_id', table_name='auth_sessions')
    op.drop_table('auth_sessions')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_column('users', 'password_hash')
