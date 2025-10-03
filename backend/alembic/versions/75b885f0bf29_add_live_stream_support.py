"""add_live_stream_support

Revision ID: 75b885f0bf29
Revises: ab0a9776c7fb
Create Date: 2025-10-02 22:09:39.976858

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75b885f0bf29'
down_revision: Union[str, Sequence[str], None] = 'ab0a9776c7fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add stream_url column
    op.add_column('videos', sa.Column('stream_url', sa.String(), nullable=True))
    # Add is_live_stream column
    op.add_column('videos', sa.Column('is_live_stream', sa.Boolean(), server_default='false', nullable=False))
    # Make file_path nullable for live streams
    op.alter_column('videos', 'file_path', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('videos', 'is_live_stream')
    op.drop_column('videos', 'stream_url')
    op.alter_column('videos', 'file_path', existing_type=sa.String(), nullable=False)
