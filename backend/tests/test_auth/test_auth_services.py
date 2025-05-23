from features.auth.services import get_password_hash, verify_password


def test_get_password_hash():
    password = "testpassword"
    hashed_password = get_password_hash(password)

    # Check if the hashed password is not empty
    assert hashed_password != ""

    # Check if the hashed password is different from the original password
    assert hashed_password != password

    # Check if the hashed password can be verified
    assert verify_password(password, hashed_password) == True
