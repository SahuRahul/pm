"""
End-to-end integration tests covering complete user journeys.
These tests intentionally cross multiple subsystems.
"""


def _do_register(client, username, password, email=None):
    r = client.post(
        "/api/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert r.status_code == 200, r.json()
    return r.json()


def _do_login(client, username, password):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.json()
    return r.cookies["session"]


# ── Journey 1: New user full PM flow ────────────────────────────────────────

def test_full_pm_journey(client):
    """
    Register → create two boards → add columns → populate cards with priority
    → label cards → move cards → verify board state.
    """
    # 1. Register & login
    _do_register(client, "pm_user", "pmpass123")
    session = _do_login(client, "pm_user", "pmpass123")

    # 2. Verify initial board created
    boards = client.get("/api/boards", cookies={"session": session}).json()
    assert len(boards) == 1
    board1_id = boards[0]["id"]

    # 3. Create a second board (Sprint board)
    sprint = client.post(
        "/api/boards",
        json={"name": "Sprint 1", "description": "Two-week sprint"},
        cookies={"session": session},
    ).json()
    sprint_id = sprint["id"]

    # 4. Add a "Blocked" column to the sprint board
    board_data = client.get(f"/api/boards/{sprint_id}", cookies={"session": session}).json()
    new_col = client.post(
        "/api/columns",
        json={"boardId": int(sprint_id), "title": "Blocked", "color": "#ff0000"},
        cookies={"session": session},
    ).json()
    assert new_col["title"] == "Blocked"
    assert new_col["color"] == "#ff0000"

    # 5. Populate sprint board with cards
    col_id = int(board_data["columns"][0]["id"])  # Backlog
    col2_id = int(board_data["columns"][2]["id"])  # In Progress

    card1 = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "Auth service", "priority": "high", "dueDate": "2026-07-01"},
        cookies={"session": session},
    ).json()
    card2 = client.post(
        "/api/cards",
        json={"columnId": col_id, "title": "DB schema", "priority": "medium"},
        cookies={"session": session},
    ).json()
    card3 = client.post(
        "/api/cards",
        json={"columnId": col2_id, "title": "API endpoints", "priority": "high"},
        cookies={"session": session},
    ).json()

    # 6. Create and assign labels
    bug_label = client.post(
        "/api/labels", json={"name": "backend", "color": "#753991"}, cookies={"session": session}
    ).json()
    fe_label = client.post(
        "/api/labels", json={"name": "frontend", "color": "#209dd7"}, cookies={"session": session}
    ).json()

    client.post(f"/api/cards/{card1['id']}/labels/{bug_label['id']}", cookies={"session": session})
    client.post(f"/api/cards/{card3['id']}/labels/{fe_label['id']}", cookies={"session": session})

    # 7. Move card1 from Backlog → In Progress
    client.patch(
        f"/api/cards/{card1['id']}/move",
        json={"columnId": col2_id, "position": 0},
        cookies={"session": session},
    )

    # 8. Verify final board state
    final = client.get(f"/api/boards/{sprint_id}", cookies={"session": session}).json()

    backlog = next(c for c in final["columns"] if c["title"] == "Backlog")
    in_progress = next(c for c in final["columns"] if c["title"] == "In Progress")

    assert str(card1["id"]) not in backlog["cardIds"]
    assert str(card1["id"]) in in_progress["cardIds"]
    assert str(card2["id"]) in backlog["cardIds"]

    # card1 has backend label
    assert any(l["name"] == "backend" for l in final["cards"][str(card1["id"])]["labels"])
    # card3 has frontend label
    assert any(l["name"] == "frontend" for l in final["cards"][str(card3["id"])]["labels"])
    # card1 has due date
    assert final["cards"][str(card1["id"])]["dueDate"] == "2026-07-01"
    # card1 has high priority
    assert final["cards"][str(card1["id"])]["priority"] == "high"

    # 9. Delete card2 and verify
    client.delete(f"/api/cards/{card2['id']}", cookies={"session": session})
    final2 = client.get(f"/api/boards/{sprint_id}", cookies={"session": session}).json()
    assert str(card2["id"]) not in final2["cards"]


# ── Journey 2: Multi-user isolation ─────────────────────────────────────────

def test_multi_user_isolation(client):
    """Two users can't see each other's data at any level."""
    _do_register(client, "alice_iso", "alicepass")
    _do_register(client, "bob_iso", "bobpass00")
    session_a = _do_login(client, "alice_iso", "alicepass")
    session_b = _do_login(client, "bob_iso", "bobpass00")

    # Alice creates a board and label
    alice_board = client.post(
        "/api/boards", json={"name": "Alice Private"}, cookies={"session": session_a}
    ).json()
    alice_label = client.post(
        "/api/labels", json={"name": "alice-label"}, cookies={"session": session_a}
    ).json()

    # Bob can't see Alice's board
    bob_boards = client.get("/api/boards", cookies={"session": session_b}).json()
    assert not any(b["id"] == alice_board["id"] for b in bob_boards)

    # Bob can't GET Alice's board
    res = client.get(f"/api/boards/{alice_board['id']}", cookies={"session": session_b})
    assert res.status_code in (403, 404)

    # Bob can't PATCH Alice's board
    res = client.patch(
        f"/api/boards/{alice_board['id']}", json={"name": "Hijacked"},
        cookies={"session": session_b}
    )
    assert res.status_code in (403, 404)

    # Bob can't see Alice's labels
    bob_labels = client.get("/api/labels", cookies={"session": session_b}).json()
    assert not any(l["id"] == alice_label["id"] for l in bob_labels)


# ── Journey 3: Board lifecycle with column management ───────────────────────

def test_board_column_lifecycle(client):
    """Create board → add column → add cards → delete column (cascades) → rename remaining."""
    _do_register(client, "lifecycle_u", "lifecyclepass")
    session = _do_login(client, "lifecycle_u", "lifecyclepass")

    board = client.post(
        "/api/boards", json={"name": "Lifecycle Board"}, cookies={"session": session}
    ).json()
    board_id = board["id"]

    # Get board columns
    board_data = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    cols = board_data["columns"]
    extra_col = client.post(
        "/api/columns",
        json={"boardId": int(board_id), "title": "Extra"},
        cookies={"session": session},
    ).json()

    # Add cards to extra column
    for i in range(3):
        client.post(
            "/api/cards",
            json={"columnId": int(extra_col["id"]), "title": f"Card {i}"},
            cookies={"session": session},
        )

    # Verify 6 columns and 3 cards in extra
    bd = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    assert len(bd["columns"]) == 6
    extra = next(c for c in bd["columns"] if c["title"] == "Extra")
    assert len(extra["cardIds"]) == 3

    # Delete extra column — cards should cascade
    client.delete(f"/api/columns/{extra_col['id']}", cookies={"session": session})

    bd2 = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    assert len(bd2["columns"]) == 5
    # All 3 cards should be gone
    assert len(bd2["cards"]) == 0

    # Rename remaining columns
    first_col_id = bd2["columns"][0]["id"]
    r = client.patch(
        f"/api/columns/{first_col_id}",
        json={"title": "Todo"},
        cookies={"session": session},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Todo"


# ── Journey 4: Label lifecycle ────────────────────────────────────────────

def test_label_full_lifecycle(client):
    """Create labels → assign to multiple cards → update label → delete label (cascades)."""
    _do_register(client, "label_user", "labelpass1")
    session = _do_login(client, "label_user", "labelpass1")

    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_data = client.get(f"/api/boards/{boards[0]['id']}", cookies={"session": session}).json()
    col_id = int(board_data["columns"][0]["id"])

    # Create 2 cards
    c1 = client.post("/api/cards", json={"columnId": col_id, "title": "C1"}, cookies={"session": session}).json()
    c2 = client.post("/api/cards", json={"columnId": col_id, "title": "C2"}, cookies={"session": session}).json()

    # Create label and assign to both
    lbl = client.post("/api/labels", json={"name": "shared-tag", "color": "#abc"}, cookies={"session": session}).json()
    client.post(f"/api/cards/{c1['id']}/labels/{lbl['id']}", cookies={"session": session})
    client.post(f"/api/cards/{c2['id']}/labels/{lbl['id']}", cookies={"session": session})

    # Update label color
    upd = client.patch(
        f"/api/labels/{lbl['id']}",
        json={"color": "#xyz"},
        cookies={"session": session},
    ).json()
    assert upd["color"] == "#xyz"

    # Delete label — both assignments should vanish
    client.delete(f"/api/labels/{lbl['id']}", cookies={"session": session})

    bd = client.get(f"/api/boards/{boards[0]['id']}", cookies={"session": session}).json()
    assert bd["cards"][c1["id"]]["labels"] == []
    assert bd["cards"][c2["id"]]["labels"] == []


# ── Journey 5: Reorder then verify ───────────────────────────────────────────

def test_reorder_columns_then_verify(client):
    """Reorder columns and verify the new order is persisted."""
    _do_register(client, "reorder_u", "reorderpass")
    session = _do_login(client, "reorder_u", "reorderpass")

    boards = client.get("/api/boards", cookies={"session": session}).json()
    board_id = boards[0]["id"]
    board_data = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()

    original_ids = [int(c["id"]) for c in board_data["columns"]]
    reversed_ids = list(reversed(original_ids))

    r = client.patch(
        f"/api/boards/{board_id}/reorder-columns",
        json={"columnIds": reversed_ids},
        cookies={"session": session},
    )
    assert r.status_code == 200

    bd2 = client.get(f"/api/boards/{board_id}", cookies={"session": session}).json()
    after_ids = [int(c["id"]) for c in bd2["columns"]]
    assert after_ids == reversed_ids

    # Titles also match the new order
    expected_titles = [
        board_data["columns"][4]["title"],
        board_data["columns"][3]["title"],
        board_data["columns"][2]["title"],
        board_data["columns"][1]["title"],
        board_data["columns"][0]["title"],
    ]
    actual_titles = [c["title"] for c in bd2["columns"]]
    assert actual_titles == expected_titles
