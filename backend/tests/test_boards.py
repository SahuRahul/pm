"""Tests for multi-board management."""


def _login(client, username="user", password="password"):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.json()
    return r.cookies["session"]


def test_list_boards_returns_default(client):
    session = _login(client)
    res = client.get("/api/boards", cookies={"session": session})
    assert res.status_code == 200
    boards = res.json()
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"
    assert "columnCount" in boards[0]
    assert "cardCount" in boards[0]


def test_create_board(client):
    session = _login(client)
    res = client.post("/api/boards", json={"name": "Sprint Board"}, cookies={"session": session})
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Sprint Board"
    assert "id" in data

    boards = client.get("/api/boards", cookies={"session": session}).json()
    assert len(boards) == 2
    assert any(b["name"] == "Sprint Board" for b in boards)


def test_create_board_with_description(client):
    session = _login(client)
    res = client.post(
        "/api/boards",
        json={"name": "Product Board", "description": "Track product work"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    assert res.json()["description"] == "Track product work"


def test_create_board_empty_name(client):
    session = _login(client)
    res = client.post("/api/boards", json={"name": "  "}, cookies={"session": session})
    assert res.status_code == 400


def test_get_board_by_id(client):
    session = _login(client)
    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]

    res = client.get(f"/api/boards/{board_id}", cookies={"session": session})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == board_id
    assert "columns" in data
    assert "cards" in data
    assert len(data["columns"]) == 5  # default columns


def test_get_board_has_full_data(client):
    session = _login(client)
    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]
    board_data = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    assert "name" in board_data
    assert "description" in board_data
    for col in board_data["columns"]:
        assert "id" in col
        assert "title" in col
        assert "cardIds" in col
        assert "color" in col


def test_rename_board(client):
    session = _login(client)
    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]

    res = client.patch(
        f"/api/boards/{board_id}",
        json={"name": "New Name"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "New Name"

    boards_after = client.get("/api/boards", cookies={"session": session}).json()
    assert any(b["name"] == "New Name" for b in boards_after)


def test_update_board_description(client):
    session = _login(client)
    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]

    res = client.patch(
        f"/api/boards/{board_id}",
        json={"description": "This is my main board"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    assert res.json()["description"] == "This is my main board"


def test_delete_board(client):
    session = _login(client)
    create_res = client.post("/api/boards", json={"name": "To Delete"}, cookies={"session": session})
    board_id = create_res.json()["id"]

    del_res = client.delete(f"/api/boards/{board_id}", cookies={"session": session})
    assert del_res.status_code == 200

    boards = client.get("/api/boards", cookies={"session": session}).json()
    assert not any(b["id"] == board_id for b in boards)


def test_cannot_delete_only_board(client):
    session = _login(client)
    boards = client.get("/api/boards", cookies={"session": session}).json()
    assert len(boards) == 1
    board_id = boards[0]["id"]

    res = client.delete(f"/api/boards/{board_id}", cookies={"session": session})
    assert res.status_code == 400


def test_board_isolation_between_users(client):
    """Each user only sees their own boards."""
    client.post("/api/auth/register", json={"username": "userA", "password": "passA01"})
    client.post("/api/auth/register", json={"username": "userB", "password": "passB01"})

    session_a = _login(client, "userA", "passA01")
    session_b = _login(client, "userB", "passB01")

    client.post("/api/boards", json={"name": "A Board"}, cookies={"session": session_a})

    boards_a = client.get("/api/boards", cookies={"session": session_a}).json()
    boards_b = client.get("/api/boards", cookies={"session": session_b}).json()

    assert any(b["name"] == "A Board" for b in boards_a)
    assert not any(b["name"] == "A Board" for b in boards_b)


def test_cannot_access_another_users_board(client):
    client.post("/api/auth/register", json={"username": "owner", "password": "ownerpass"})
    client.post("/api/auth/register", json={"username": "thief", "password": "thiefpass"})

    session_owner = _login(client, "owner", "ownerpass")
    session_thief = _login(client, "thief", "thiefpass")

    boards = client.get("/api/boards", cookies={"session": session_owner}).json()
    board_id = boards[0]["id"]

    res = client.get(f"/api/boards/{board_id}", cookies={"session": session_thief})
    assert res.status_code in (403, 404)


def test_reorder_columns(client):
    session = _login(client)
    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]
    board_data = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()

    col_ids = [int(c["id"]) for c in board_data["columns"]]
    reversed_ids = list(reversed(col_ids))

    res = client.patch(
        f"/api/boards/{board_id}/reorder-columns",
        json={"columnIds": reversed_ids},
        cookies={"session": session},
    )
    assert res.status_code == 200

    board_after = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    after_ids = [int(c["id"]) for c in board_after["columns"]]
    assert after_ids == reversed_ids


def test_reorder_columns_wrong_ids(client):
    session = _login(client)
    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]

    res = client.patch(
        f"/api/boards/{board_id}/reorder-columns",
        json={"columnIds": [99999, 88888]},
        cookies={"session": session},
    )
    assert res.status_code == 400


def test_board_requires_auth(client):
    assert client.get("/api/boards").status_code == 401
    assert client.post("/api/boards", json={"name": "x"}).status_code == 401
    assert client.get("/api/boards/1").status_code == 401
    assert client.patch("/api/boards/1", json={"name": "x"}).status_code == 401
    assert client.delete("/api/boards/1").status_code == 401
