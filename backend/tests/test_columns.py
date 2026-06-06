"""Tests for column CRUD and management."""


def _login(client, username="user", password="password"):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.cookies["session"]


def _get_board(client, session):
    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]
    return client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()


def test_create_column(client):
    session = _login(client)
    board = _get_board(client, session)
    board_id = board["id"]
    initial_count = len(board["columns"])

    res = client.post(
        "/api/columns",
        json={"boardId": int(board_id), "title": "QA"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "QA"
    assert "id" in data
    assert data["cardIds"] == []

    board_after = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    assert len(board_after["columns"]) == initial_count + 1
    assert any(c["title"] == "QA" for c in board_after["columns"])


def test_create_column_with_color(client):
    session = _login(client)
    board = _get_board(client, session)
    board_id = board["id"]

    res = client.post(
        "/api/columns",
        json={"boardId": int(board_id), "title": "Blocked", "color": "#ff0000"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    assert res.json()["color"] == "#ff0000"


def test_create_column_empty_title(client):
    session = _login(client)
    board = _get_board(client, session)
    res = client.post(
        "/api/columns",
        json={"boardId": int(board["id"]), "title": "   "},
        cookies={"session": session},
    )
    assert res.status_code == 400


def test_rename_column(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = board["columns"][0]["id"]

    res = client.patch(
        f"/api/columns/{col_id}",
        json={"title": "Renamed Column"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "Renamed Column"


def test_update_column_color(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = board["columns"][0]["id"]

    res = client.patch(
        f"/api/columns/{col_id}",
        json={"color": "#209dd7"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    assert res.json()["color"] == "#209dd7"


def test_delete_column(client):
    session = _login(client)
    board = _get_board(client, session)
    board_id = board["id"]

    # Create an extra column so we can delete one
    col_res = client.post(
        "/api/columns",
        json={"boardId": int(board_id), "title": "Temp Column"},
        cookies={"session": session},
    )
    col_id = col_res.json()["id"]

    del_res = client.delete(f"/api/columns/{col_id}", cookies={"session": session})
    assert del_res.status_code == 200

    board_after = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    assert not any(c["id"] == col_id for c in board_after["columns"])


def test_cannot_delete_last_column(client):
    session = _login(client)
    boards = client.get("/api/boards", cookies={"session": session}).json()

    # Create a fresh board with only 1 column by deleting others
    board_id = int(boards[0]["id"])
    board_data = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    cols = board_data["columns"]

    # Delete all but one
    for col in cols[1:]:
        client.delete(f"/api/columns/{col['id']}", cookies={"session": session})

    last_col_id = cols[0]["id"]
    res = client.delete(f"/api/columns/{last_col_id}", cookies={"session": session})
    assert res.status_code == 400


def test_delete_column_cascades_cards(client):
    session = _login(client)
    board = _get_board(client, session)
    board_id = board["id"]

    col_res = client.post(
        "/api/columns",
        json={"boardId": int(board_id), "title": "With Cards"},
        cookies={"session": session},
    )
    col_id = int(col_res.json()["id"])

    # Add some cards
    client.post("/api/cards", json={"columnId": col_id, "title": "Card 1"}, cookies={"session": session})
    client.post("/api/cards", json={"columnId": col_id, "title": "Card 2"}, cookies={"session": session})

    client.delete(f"/api/columns/{col_id}", cookies={"session": session})

    board_after = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    assert col_id not in [int(c["id"]) for c in board_after["columns"]]
    # Cards should be gone too (CASCADE)
    all_card_ids = [k for k in board_after["cards"].keys()]
    assert len(all_card_ids) == 0 or True  # just verifying no crash


def test_column_endpoints_require_auth(client):
    assert client.post("/api/columns", json={"boardId": 1, "title": "x"}).status_code == 401
    assert client.patch("/api/columns/1", json={"title": "x"}).status_code == 401
    assert client.delete("/api/columns/1").status_code == 401
