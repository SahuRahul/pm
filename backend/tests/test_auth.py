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
    response = client.post("/api/auth/login", json={"username": "admin", "password": "password"})
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
    assert response.json()["username"] == "user"


def test_logout(client):
    login_res = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert login_res.status_code == 200
    response = client.post("/api/auth/logout", cookies={"session": login_res.cookies["session"]})
    assert response.status_code == 200
    assert response.json() == {"ok": True}
