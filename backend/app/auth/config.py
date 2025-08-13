from datetime import timedelta

# 🔐  Put secrets in Render’s dashboard later; hard-coded for now
SECRET_KEY: str = "77931d99d749e8e2d0b589d74b5fbb346c6b0130916976a9591156b2bab516fb"
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

# Temporary in-memory “DB”
USERS_DB = {
    "yinon": {
        "username": "yinon",
        "full_name": "yinon kedem",
        "email": "yinonke@Gmail.com",
        # hashed pwd to be filled by utils.init_dummy_user()
        "hashed_password": "",
        "disabled": False,
    }
}

TOKEN_EXPIRE = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
