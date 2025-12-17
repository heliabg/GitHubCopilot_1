import copy
import pytest
from fastapi.testclient import TestClient

import src.app as app_mod

client = TestClient(app_mod.app)

# Keep an original snapshot so tests can reset in-memory DB
_ORIGINAL_ACTIVITIES = copy.deepcopy(app_mod.activities)

@pytest.fixture(autouse=True)
def reset_activities():
    # Reset the in-memory activities before each test
    app_mod.activities = copy.deepcopy(_ORIGINAL_ACTIVITIES)
    yield


def test_get_activities():
    res = client.get("/activities")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    assert "Chess Club" in data


def test_signup_success():
    email = "tester@example.com"
    res = client.post("/activities/Basketball/signup?email=%s" % email)
    assert res.status_code == 200
    payload = res.json()
    assert "Signed up" in payload["message"]

    # Verify participant added
    assert email in app_mod.activities["Basketball"]["participants"]


def test_duplicate_signup_returns_400():
    email = "dup@example.com"
    res1 = client.post("/activities/Tennis Club/signup?email=%s" % email)
    assert res1.status_code == 200

    res2 = client.post("/activities/Tennis Club/signup?email=%s" % email)
    assert res2.status_code == 400
    payload = res2.json()
    assert payload.get("detail")


def test_activity_capacity_enforced():
    # Create a tiny activity with max_participants = 1
    app_mod.activities["Tiny Club"] = {
        "description": "Tiny",
        "schedule": "Now",
        "max_participants": 1,
        "participants": []
    }

    res1 = client.post("/activities/Tiny Club/signup?email=a@example.com")
    assert res1.status_code == 200

    res2 = client.post("/activities/Tiny Club/signup?email=b@example.com")
    assert res2.status_code == 400
    assert res2.json().get("detail") == "Activity is full"


def test_remove_participant_and_errors():
    # Remove an existing participant
    # "james@mergington.edu" is in Basketball initially
    res = client.delete("/activities/Basketball/participants?email=james@mergington.edu")
    assert res.status_code == 200
    assert "Removed" in res.json()["message"]
    assert "james@mergington.edu" not in app_mod.activities["Basketball"]["participants"]

    # Trying to remove again should 404
    res2 = client.delete("/activities/Basketball/participants?email=james@mergington.edu")
    assert res2.status_code == 404
    assert res2.json().get("detail") == "Participant not found"
