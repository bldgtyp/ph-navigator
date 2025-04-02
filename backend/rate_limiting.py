# -*- Python Version: 3.11 (Render.com) -*-

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
