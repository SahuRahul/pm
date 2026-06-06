"""Tests for card CRUD including priority and due dates."""


def _login(client, username="user", password="password"):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.cookies["session"]


def _get_board(client, session):
    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]
    return client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()


def test_create_card_default_priority(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])

    res = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "Basic Card"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["priority"] == "medium"
    assert data["dueDate"] is None


def test_create_card_with_priority(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])

    res = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "Urgent", "priority": "high"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    assert res.json()["priority"] == "high"


def test_create_card_with_due_date(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])

    res = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "Deadline Task", "dueDate": "2026-07-01"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    assert res.json()["dueDate"] == "2026-07-01"


def test_update_card_priority(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])

    create_res = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "Change Priority"},
        cookies={"session": session},
    )
    card_id = create_res.json()["id"]

    update_res = client.patch(
        f"/api/cards/{card_id}",
        json={"priority": "low"},
        cookies={"session": session},
    )
    assert update_res.status_code == 200
    assert update_res.json()["priority"] == "low"


def test_update_card_due_date(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])

    create_res = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "Set Deadline"},
        cookies={"session": session},
    )
    card_id = create_res.json()["id"]

    update_res = client.patch(
        f"/api/cards/{card_id}",
        json={"dueDate": "2026-12-31"},
        cookies={"session": session},
    )
    assert update_res.status_code == 200
    assert update_res.json()["dueDate"] == "2026-12-31"


def test_update_card_all_fields(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])

    create_res = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "Original"},
        cookies={"session": session},
    )
    card_id = create_res.json()["id"]

    update_res = client.patch(
        f"/api/cards/{card_id}",
        json={"title": "Updated", "details": "New details", "priority": "high", "dueDate": "2026-09-15"},
        cookies={"session": session},
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["title"] == "Updated"
    assert data["details"] == "New details"
    assert data["priority"] == "high"
    assert data["dueDate"] == "2026-09-15"


def test_card_appears_in_board_with_priority(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])
    board_id = board["id"]

    client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "Important", "priority": "high", "dueDate": "2026-08-01"},
        cookies={"session": session},
    )

    board_after = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    cards = board_after["cards"]
    found = next((c for c in cards.values() if c["title"] == "Important"), None)
    assert found is not None
    assert found["priority"] == "high"
    assert found["dueDate"] == "2026-08-01"


def test_invalid_priority_defaults_to_medium(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])

    res = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "Card", "priority": "urgent"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    assert res.json()["priority"] == "medium"


def test_delete_card(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])
    board_id = board["id"]

    create_res = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "To Delete"},
        cookies={"session": session},
    )
    card_id = create_res.json()["id"]

    del_res = client.delete(f"/api/cards/{card_id}", cookies={"session": session})
    assert del_res.status_code == 200

    board_after = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    assert card_id not in board_after["cards"]


def test_move_card_cross_column(client):
    session = _login(client)
    board = _get_board(client, session)
    col1_id = int(board["columns"][0]["id"])
    col2_id = int(board["columns"][1]["id"])
    board_id = board["id"]

    create_res = client.post(
        "/api/cards",
        json={"columnId": col1_id, "title": "Move Me"},
        cookies={"session": session},
    )
    card_id = int(create_res.json()["id"])

    move_res = client.patch(
        f"/api/cards/{card_id}/move",
        json={"columnId": col2_id, "position": 0},
        cookies={"session": session},
    )
    assert move_res.status_code == 200

    board_after = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    col2 = next(c for c in board_after["columns"] if int(c["id"]) == col2_id)
    assert str(card_id) in col2["cardIds"]


def test_card_ordering(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])
    board_id = board["id"]

    ids = []
    for i in range(3):
        r = client.post(
            "/api/cards",
            json={"columnId": col_id, "title": f"Card {i}"},
            cookies={"session": session},
        )
        ids.append(r.json()["id"])

    board_after = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    col = next(c for c in board_after["columns"] if int(c["id"]) == col_id)
    assert col["cardIds"] == ids


def test_card_endpoints_require_auth(client):
    assert client.post("/api/cards", json={"columnId": 1, "title": "x"}).status_code == 401
    assert client.patch("/api/cards/1", json={"title": "x"}).status_code == 401
    assert client.delete("/api/cards/1").status_code == 401
    assert client.patch("/api/cards/1/move", json={"columnId": 1, "position": 0}).status_code == 401
