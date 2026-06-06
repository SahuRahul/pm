def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_login_success(client):
    response = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert "session" in response.cookies


def test_login_wrong_password(client):
    response = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert response.status_code == 401


def test_login_wrong_username(client):
    response = client.post("/api/auth/login", json={"username": "nobody", "password": "password"})
    assert response.status_code == 401


def test_me_unauthenticated(client):
    client.cookies.clear()
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_authenticated(client):
    login_res = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert login_res.status_code == 200
    response = client.get("/api/auth/me", cookies={"session": login_res.cookies["session"]})
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "user"
    assert data["role"] == "admin"


def test_logout(client):
    login_res = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert login_res.status_code == 200
    response = client.post("/api/auth/logout", cookies={"session": login_res.cookies["session"]})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


# --- Registration ---

def test_register_success(client):
    res = client.post("/api/auth/register", json={"username": "newuser", "password": "securepass"})
    assert res.status_code == 200
    assert res.json()["username"] == "newuser"


def test_register_then_login(client):
    client.post("/api/auth/register", json={"username": "alice", "password": "alicepass"})
    login_res = client.post("/api/auth/login", json={"username": "alice", "password": "alicepass"})
    assert login_res.status_code == 200
    me_res = client.get("/api/auth/me", cookies={"session": login_res.cookies["session"]})
    assert me_res.json()["username"] == "alice"


def test_register_duplicate_username(client):
    client.post("/api/auth/register", json={"username": "bob", "password": "bobpass1"})
    res = client.post("/api/auth/register", json={"username": "bob", "password": "bobpass2"})
    assert res.status_code == 409


def test_register_short_username(client):
    res = client.post("/api/auth/register", json={"username": "ab", "password": "validpassword"})
    assert res.status_code == 400


def test_register_short_password(client):
    res = client.post("/api/auth/register", json={"username": "validuser", "password": "abc"})
    assert res.status_code == 400


def test_register_with_email(client):
    res = client.post("/api/auth/register", json={
        "username": "carol",
        "password": "carolpass",
        "email": "carol@example.com",
    })
    assert res.status_code == 200
    login_res = client.post("/api/auth/login", json={"username": "carol", "password": "carolpass"})
    me_res = client.get("/api/auth/me", cookies={"session": login_res.cookies["session"]})
    assert me_res.json()["email"] == "carol@example.com"


# --- Admin user management ---

def _admin_session(client):
    r = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    return r.cookies["session"]


def test_list_users_requires_admin(client):
    client.post("/api/auth/register", json={"username": "regular", "password": "regularpass"})
    login_res = client.post("/api/auth/login", json={"username": "regular", "password": "regularpass"})
    res = client.get("/api/users", cookies={"session": login_res.cookies["session"]})
    assert res.status_code == 403


def test_list_users_as_admin(client):
    session = _admin_session(client)
    client.post("/api/auth/register", json={"username": "user1", "password": "user1pass"})
    res = client.get("/api/users", cookies={"session": session})
    assert res.status_code == 200
    usernames = [u["username"] for u in res.json()]
    assert "user" in usernames
    assert "user1" in usernames


def test_delete_user_as_admin(client):
    session = _admin_session(client)
    client.post("/api/auth/register", json={"username": "todelete", "password": "deletepass"})
    users = client.get("/api/users", cookies={"session": session}).json()
    target = next(u for u in users if u["username"] == "todelete")
    res = client.delete(f"/api/users/{target['id']}", cookies={"session": session})
    assert res.status_code == 200
    users_after = client.get("/api/users", cookies={"session": session}).json()
    assert not any(u["username"] == "todelete" for u in users_after)


def test_admin_cannot_delete_self(client):
    session = _admin_session(client)
    users = client.get("/api/users", cookies={"session": session}).json()
    admin = next(u for u in users if u["username"] == "user")
    res = client.delete(f"/api/users/{admin['id']}", cookies={"session": session})
    assert res.status_code == 400
