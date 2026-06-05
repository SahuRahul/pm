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
    response = client.post("/api/cards", json={"columnId": 1, "title": "x"})
    assert response.status_code == 401


def test_board_crud_flow(client):
    session = login(client)
    board = client.get("/api/board", cookies={"session": session}).json()
    assert len(board["columns"]) == 5

    first_column_id = int(board["columns"][0]["id"])

    create_res = client.post(
        "/api/cards",
        json={"columnId": first_column_id, "title": "New", "details": "Notes"},
        cookies={"session": session},
    )
    assert create_res.status_code == 200
    card_id = int(create_res.json()["id"])

    rename_res = client.patch(
        f"/api/columns/{first_column_id}",
        json={"title": "Renamed"},
        cookies={"session": session},
    )
    assert rename_res.status_code == 200

    move_res = client.patch(
        f"/api/cards/{card_id}/move",
        json={"columnId": first_column_id, "position": 0},
        cookies={"session": session},
    )
    assert move_res.status_code == 200

    delete_res = client.delete(
        f"/api/cards/{card_id}",
        cookies={"session": session},
    )
    assert delete_res.status_code == 200
