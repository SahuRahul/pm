"""Tests for card comment CRUD and auth guards."""
import pytest


def _login(client, username="user", password="password"):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return r


def _card_id(client):
    """Return a valid card_id from the user's first board."""
    board_list = client.get("/api/boards").json()
    board = client.get(f"/api/boards/{board_list[0]['id']}").json()
    col = board["columns"][0]
    if col["cardIds"]:
        return col["cardIds"][0]
    r = client.post("/api/cards", json={"columnId": int(col["id"]), "title": "comment test card"})
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture
def auth_client(client):
    _login(client)
    return client


@pytest.fixture
def card(auth_client):
    return _card_id(auth_client)


# --- List/create comments ---

def test_list_comments_empty(auth_client, card):
    r = auth_client.get(f"/api/cards/{card}/comments")
    assert r.status_code == 200
    assert r.json() == []


def test_create_comment(auth_client, card):
    r = auth_client.post(f"/api/cards/{card}/comments", json={"body": "First comment"})
    assert r.status_code == 200
    data = r.json()
    assert data["body"] == "First comment"
    assert data["author"] == "user"
    assert "id" in data
    assert "createdAt" in data


def test_list_comments_after_create(auth_client, card):
    auth_client.post(f"/api/cards/{card}/comments", json={"body": "Alpha"})
    auth_client.post(f"/api/cards/{card}/comments", json={"body": "Beta"})
    r = auth_client.get(f"/api/cards/{card}/comments")
    assert r.status_code == 200
    bodies = [c["body"] for c in r.json()]
    assert bodies == ["Alpha", "Beta"]


def test_create_comment_empty_body(auth_client, card):
    r = auth_client.post(f"/api/cards/{card}/comments", json={"body": "   "})
    assert r.status_code == 400


def test_create_comment_missing_body(auth_client, card):
    r = auth_client.post(f"/api/cards/{card}/comments", json={})
    assert r.status_code == 422


# --- Delete comments ---

def test_delete_comment(auth_client, card):
    create = auth_client.post(f"/api/cards/{card}/comments", json={"body": "To delete"})
    comment_id = create.json()["id"]
    r = auth_client.delete(f"/api/comments/{comment_id}")
    assert r.status_code == 200
    remaining = auth_client.get(f"/api/cards/{card}/comments").json()
    assert all(c["id"] != comment_id for c in remaining)


def test_delete_nonexistent_comment(auth_client):
    r = auth_client.delete("/api/comments/99999")
    assert r.status_code == 404


def test_delete_other_user_comment(client):
    """User B cannot delete User A's comment."""
    _login(client)
    board_list = client.get("/api/boards").json()
    board = client.get(f"/api/boards/{board_list[0]['id']}").json()
    col = board["columns"][0]
    card_r = client.post("/api/cards", json={"columnId": int(col["id"]), "title": "shared card"})
    card_id = card_r.json()["id"]
    comment_r = client.post(f"/api/cards/{card_id}/comments", json={"body": "User A comment"})
    comment_id = comment_r.json()["id"]

    # Register user B
    client.post("/api/auth/register", json={"username": "userb", "password": "passwordb"})
    client.post("/api/auth/login", json={"username": "userb", "password": "passwordb"})
    r = client.delete(f"/api/comments/{comment_id}")
    # user B's card differs; the comment belongs to user A
    assert r.status_code in (403, 404)


# --- Auth guards ---

def test_comments_require_auth(client, card_id=1):
    r = client.get(f"/api/cards/1/comments")
    assert r.status_code in (401, 403)


def test_add_comment_requires_auth(client):
    r = client.post("/api/cards/1/comments", json={"body": "hello"})
    assert r.status_code in (401, 403)


# --- Card isolation ---

def test_cannot_comment_on_other_users_card(client):
    """User A cannot comment on User B's cards."""
    # Register and login as user B, get their card
    client.post("/api/auth/register", json={"username": "userc", "password": "passwordc"})
    client.post("/api/auth/login", json={"username": "userc", "password": "passwordc"})
    boards_b = client.get("/api/boards").json()
    board_b = client.get(f"/api/boards/{boards_b[0]['id']}").json()
    col_b = board_b["columns"][0]
    card_b = client.post("/api/cards", json={"columnId": int(col_b["id"]), "title": "user c card"}).json()["id"]

    # Login as default user
    client.post("/api/auth/login", json={"username": "user", "password": "password"})
    r = client.post(f"/api/cards/{card_b}/comments", json={"body": "sneaky comment"})
    assert r.status_code == 403


# --- Profile update ---

def test_update_email(auth_client):
    r = auth_client.patch("/api/auth/me", json={"email": "new@example.com"})
    assert r.status_code == 200
    assert r.json()["email"] == "new@example.com"


def test_update_password_success(auth_client):
    r = auth_client.patch("/api/auth/me", json={
        "currentPassword": "password",
        "password": "newpassword123"
    })
    assert r.status_code == 200
    # Old password no longer works
    login_r = auth_client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert login_r.status_code == 401
    # New password works
    login_r2 = auth_client.post("/api/auth/login", json={"username": "user", "password": "newpassword123"})
    assert login_r2.status_code == 200


def test_update_password_wrong_current(auth_client):
    r = auth_client.patch("/api/auth/me", json={
        "currentPassword": "wrongpassword",
        "password": "newpassword123"
    })
    assert r.status_code == 401


def test_update_password_too_short(auth_client):
    r = auth_client.patch("/api/auth/me", json={
        "currentPassword": "password",
        "password": "abc"
    })
    assert r.status_code == 400


def test_update_password_no_current(auth_client):
    r = auth_client.patch("/api/auth/me", json={"password": "newpassword123"})
    assert r.status_code == 400
