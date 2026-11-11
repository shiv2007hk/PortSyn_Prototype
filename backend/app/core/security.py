import hashlib
import hmac
import secrets

PBKDF2_ITERATIONS = 260_000
PBKDF2_PREFIX = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("ascii"), PBKDF2_ITERATIONS)
    return f"{PBKDF2_PREFIX}${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        prefix, iterations, salt, expected = stored.split("$", 3)
    except ValueError:
        return False
    if prefix != PBKDF2_PREFIX:
        return False
    try:
        rounds = int(iterations)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("ascii"), rounds)
    return hmac.compare_digest(digest.hex(), expected)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def password_issues(password: str) -> list[str]:
    issues: list[str] = []
    if len(password) < 8:
        issues.append("Use at least 8 characters.")
    if not any(character.isalpha() for character in password):
        issues.append("Include at least one letter.")
    if not any(character.isdigit() for character in password):
        issues.append("Include at least one number.")
    return issues
