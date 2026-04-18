SUPER_ADMIN = "super_admin"
COMPETITION_MANAGER = "competition_manager"
CONTENT_EDITOR = "content_editor"
READ_ONLY_ADMIN = "read_only_admin"

ALL_ROLES = frozenset(
    {
        SUPER_ADMIN,
        COMPETITION_MANAGER,
        CONTENT_EDITOR,
        READ_ONLY_ADMIN,
    },
)


def can_manage_competition(role: str) -> bool:
    return role in (SUPER_ADMIN, COMPETITION_MANAGER)


def can_manage_content(role: str) -> bool:
    return role in (SUPER_ADMIN, CONTENT_EDITOR)


def can_read_admin(role: str) -> bool:
    return role in ALL_ROLES


def can_manage_users(role: str) -> bool:
    return role == SUPER_ADMIN


def can_write_admin(role: str) -> bool:
    return role in (SUPER_ADMIN, COMPETITION_MANAGER, CONTENT_EDITOR)
