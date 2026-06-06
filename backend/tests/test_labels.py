"""Tests for the label management system."""


def _login(client, username="user", password="password"):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.cookies["session"]


def _get_board(client, session):
    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]
    return client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()


def _create_card(client, session, col_id, title="Test Card"):
    r = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": title},
        cookies={"session": session},
    )
    return r.json()


# --- Label CRUD ---

def test_list_labels_empty(client):
    session = _login(client)
    res = client.get("/api/labels", cookies={"session": session})
    assert res.status_code == 200
    assert res.json() == []


def test_create_label(client):
    session = _login(client)
    res = client.post(
        "/api/labels",
        json={"name": "Bug", "color": "#ff0000"},
        cookies={"session": session},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Bug"
    assert data["color"] == "#ff0000"
    assert "id" in data


def test_create_label_default_color(client):
    session = _login(client)
    res = client.post("/api/labels", json={"name": "Feature"}, cookies={"session": session})
    assert res.status_code == 200
    assert "color" in res.json()


def test_create_label_empty_name(client):
    session = _login(client)
    res = client.post("/api/labels", json={"name": "  ", "color": "#fff"}, cookies={"session": session})
    assert res.status_code == 400


def test_create_duplicate_label_name(client):
    session = _login(client)
    client.post("/api/labels", json={"name": "Duplicate"}, cookies={"session": session})
    res = client.post("/api/labels", json={"name": "Duplicate"}, cookies={"session": session})
    assert res.status_code == 409


def test_list_labels_after_creation(client):
    session = _login(client)
    client.post("/api/labels", json={"name": "Alpha"}, cookies={"session": session})
    client.post("/api/labels", json={"name": "Beta"}, cookies={"session": session})

    res = client.get("/api/labels", cookies={"session": session})
    names = [l["name"] for l in res.json()]
    assert "Alpha" in names
    assert "Beta" in names


def test_update_label(client):
    session = _login(client)
    create_res = client.post("/api/labels", json={"name": "Old Name", "color": "#111"}, cookies={"session": session})
    label_id = create_res.json()["id"]

    update_res = client.patch(
        f"/api/labels/{label_id}",
        json={"name": "New Name", "color": "#222"},
        cookies={"session": session},
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["name"] == "New Name"
    assert data["color"] == "#222"


def test_update_label_partial(client):
    session = _login(client)
    create_res = client.post("/api/labels", json={"name": "Keep Color", "color": "#abc"}, cookies={"session": session})
    label_id = create_res.json()["id"]

    update_res = client.patch(
        f"/api/labels/{label_id}",
        json={"name": "Changed Name"},
        cookies={"session": session},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Changed Name"
    assert update_res.json()["color"] == "#abc"


def test_delete_label(client):
    session = _login(client)
    create_res = client.post("/api/labels", json={"name": "To Delete"}, cookies={"session": session})
    label_id = create_res.json()["id"]

    del_res = client.delete(f"/api/labels/{label_id}", cookies={"session": session})
    assert del_res.status_code == 200

    labels = client.get("/api/labels", cookies={"session": session}).json()
    assert not any(l["id"] == label_id for l in labels)


def test_delete_nonexistent_label(client):
    session = _login(client)
    res = client.delete("/api/labels/99999", cookies={"session": session})
    assert res.status_code == 404


# --- Label isolation between users ---

def test_labels_are_user_scoped(client):
    client.post("/api/auth/register", json={"username": "labA", "password": "labApass"})
    client.post("/api/auth/register", json={"username": "labB", "password": "labBpass"})
    session_a = _login(client, "labA", "labApass")
    session_b = _login(client, "labB", "labBpass")

    client.post("/api/labels", json={"name": "Only For A"}, cookies={"session": session_a})

    labels_a = client.get("/api/labels", cookies={"session": session_a}).json()
    labels_b = client.get("/api/labels", cookies={"session": session_b}).json()

    assert any(l["name"] == "Only For A" for l in labels_a)
    assert not any(l["name"] == "Only For A" for l in labels_b)


# --- Assign / unassign labels to cards ---

def test_assign_label_to_card(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])
    board_id = board["id"]

    card = _create_card(client, session, col_id)
    card_id = int(card["id"])

    label = client.post("/api/labels", json={"name": "P0"}, cookies={"session": session}).json()
    label_id = int(label["id"])

    assign_res = client.post(
        f"/api/cards/{card_id}/labels/{label_id}",
        cookies={"session": session},
    )
    assert assign_res.status_code == 200

    # Verify via card labels endpoint
    labels_res = client.get(f"/api/cards/{card_id}/labels", cookies={"session": session})
    assert labels_res.status_code == 200
    assert any(l["id"] == str(label_id) for l in labels_res.json())


def test_assign_label_appears_in_board_fetch(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])
    board_id = board["id"]

    card = _create_card(client, session, col_id, "Labeled Card")
    card_id = int(card["id"])

    label = client.post("/api/labels", json={"name": "Important"}, cookies={"session": session}).json()
    label_id = int(label["id"])

    client.post(f"/api/cards/{card_id}/labels/{label_id}", cookies={"session": session})

    board_data = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    card_data = board_data["cards"][str(card_id)]
    assert "labels" in card_data
    assert any(l["name"] == "Important" for l in card_data["labels"])


def test_unassign_label_from_card(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])

    card = _create_card(client, session, col_id)
    card_id = int(card["id"])

    label = client.post("/api/labels", json={"name": "Temp"}, cookies={"session": session}).json()
    label_id = int(label["id"])

    client.post(f"/api/cards/{card_id}/labels/{label_id}", cookies={"session": session})
    unassign_res = client.delete(
        f"/api/cards/{card_id}/labels/{label_id}",
        cookies={"session": session},
    )
    assert unassign_res.status_code == 200

    labels = client.get(f"/api/cards/{card_id}/labels", cookies={"session": session}).json()
    assert not any(l["id"] == str(label_id) for l in labels)


def test_multiple_labels_on_card(client):
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])

    card = _create_card(client, session, col_id)
    card_id = int(card["id"])

    l1 = client.post("/api/labels", json={"name": "Frontend"}, cookies={"session": session}).json()
    l2 = client.post("/api/labels", json={"name": "Backend"}, cookies={"session": session}).json()

    client.post(f"/api/cards/{card_id}/labels/{l1['id']}", cookies={"session": session})
    client.post(f"/api/cards/{card_id}/labels/{l2['id']}", cookies={"session": session})

    labels = client.get(f"/api/cards/{card_id}/labels", cookies={"session": session}).json()
    names = [l["name"] for l in labels]
    assert "Frontend" in names
    assert "Backend" in names


def test_delete_label_removes_card_assignment(client):
    """Deleting a label should cascade to card_labels."""
    session = _login(client)
    board = _get_board(client, session)
    col_id = int(board["columns"][0]["id"])
    board_id = board["id"]

    card = _create_card(client, session, col_id)
    card_id = int(card["id"])

    label = client.post("/api/labels", json={"name": "Ephemeral"}, cookies={"session": session}).json()
    label_id = int(label["id"])

    client.post(f"/api/cards/{card_id}/labels/{label_id}", cookies={"session": session})
    client.delete(f"/api/labels/{label_id}", cookies={"session": session})

    # Card should no longer have this label
    board_data = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    card_data = board_data["cards"][str(card_id)]
    assert not any(l["id"] == str(label_id) for l in card_data.get("labels", []))


def test_cannot_assign_other_users_label(client):
    client.post("/api/auth/register", json={"username": "owner2", "password": "ownerpass2"})
    client.post("/api/auth/register", json={"username": "attacker2", "password": "attackpass2"})

    session_owner = _login(client, "owner2", "ownerpass2")
    session_attacker = _login(client, "attacker2", "attackpass2")

    board_owner = _get_board(client, session_owner)
    col_id = int(board_owner["columns"][0]["id"])
    card = _create_card(client, session_owner, col_id)
    card_id = int(card["id"])

    label = client.post(
        "/api/labels", json={"name": "Mine"}, cookies={"session": session_owner}
    ).json()
    label_id = int(label["id"])

    # Attacker tries to assign owner's label to owner's card
    res = client.post(
        f"/api/cards/{card_id}/labels/{label_id}",
        cookies={"session": session_attacker},
    )
    assert res.status_code in (403, 404)


def test_label_endpoints_require_auth(client):
    assert client.get("/api/labels").status_code == 401
    assert client.post("/api/labels", json={"name": "x"}).status_code == 401
    assert client.patch("/api/labels/1", json={"name": "x"}).status_code == 401
    assert client.delete("/api/labels/1").status_code == 401
    assert client.get("/api/cards/1/labels").status_code == 401
    assert client.post("/api/cards/1/labels/1").status_code == 401
    assert client.delete("/api/cards/1/labels/1").status_code == 401
