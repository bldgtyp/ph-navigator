from time import time
from typing import Generic, TypeVar
from collections import OrderedDict

T = TypeVar('T')


class CacheRecordWithTime(Generic[T]):
    """A simple cache record with a timestamp."""
    CACHE_EXPIRATION_SECONDS = 3600  # 1 hour

    def __init__(self, data: T):
        self.data = data
        self.timestamp = time()

    @property
    def is_expired(self) -> bool:
        """Check if the cache record is expired."""
        return (time() - self.timestamp) > self.CACHE_EXPIRATION_SECONDS


class LimitedCache(Generic[T], OrderedDict[int, CacheRecordWithTime[T]]):
    """A Very simple in-memory cache for storing model data."""

    def __init__(self, max_size: int = 10):
        super().__init__()
        self.max_size = max_size

    def __setitem__(self, key: int, value: T) -> None:
        if len(self) >= self.max_size:
            self.popitem(last=False)  # Remove the oldest item
        super().__setitem__(key, CacheRecordWithTime(value))

    def __getitem__(self, key: int) -> T | None:
        try:
            d = super().__getitem__(key)
            if d.is_expired:
                del self[key]
                return None
            return d.data
        except KeyError:
            return None