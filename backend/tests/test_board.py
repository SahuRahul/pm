"""Integration test for the full board CRUD flow (backward-compat endpoint + board-scoped endpoints)."""


def login(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert response.status_code == 200
    return response.cookies["session"]


def test_board_requires_auth(client):
    response = client.get("/api/board")
    assert response.status_code == 401


def test_card_endpoints_require_auth(client):
    assert client.post("/api/cards", json={"columnId": 1, "title": "x"}).status_code == 401
    assert client.patch("/api/cards/1", json={"title": "x"}).status_code == 401
    assert client.delete("/api/cards/1").status_code == 401
    assert client.patch("/api/cards/1/move", json={"columnId": 1, "position": 0}).status_code == 401


def test_board_crud_flow(client):
    session = login(client)
    board = client.get("/api/board", cookies={"session": session}).json()
    assert len(board["columns"]) == 5
    assert "name" in board
    assert "id" in board

    first_column_id = int(board["columns"][0]["id"])
    second_column_id = int(board["columns"][1]["id"])
    board_id = int(board["id"])

    # Create
    create_res = client.post(
        "/api/cards",
        json={"columnId": first_column_id, "title": "New", "details": "Notes"},
        cookies={"session": session},
    )
    assert create_res.status_code == 200
    card_id = int(create_res.json()["id"])
    assert create_res.json()["priority"] == "medium"

    # Rename column
    rename_res = client.patch(
        f"/api/columns/{first_column_id}",
        json={"title": "Renamed"},
        cookies={"session": session},
    )
    assert rename_res.status_code == 200
    board2 = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    assert board2["columns"][0]["title"] == "Renamed"

    # Update card title and details
    update_res = client.patch(
        f"/api/cards/{card_id}",
        json={"title": "Updated", "details": "New details"},
        cookies={"session": session},
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Updated"
    assert update_res.json()["details"] == "New details"

    # Move card within same column
    move_same_res = client.patch(
        f"/api/cards/{card_id}/move",
        json={"columnId": first_column_id, "position": 0},
        cookies={"session": session},
    )
    assert move_same_res.status_code == 200

    # Move card to a different column
    move_cross_res = client.patch(
        f"/api/cards/{card_id}/move",
        json={"columnId": second_column_id, "position": 0},
        cookies={"session": session},
    )
    assert move_cross_res.status_code == 200
    board3 = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    second_col = next(c for c in board3["columns"] if int(c["id"]) == second_column_id)
    assert str(card_id) in second_col["cardIds"]

    # Delete
    delete_res = client.delete(
        f"/api/cards/{card_id}",
        cookies={"session": session},
    )
    assert delete_res.status_code == 200
    board4 = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    assert str(card_id) not in board4["cards"]
