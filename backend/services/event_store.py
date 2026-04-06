import json
from collections import defaultdict

from redis import Redis

from config import get_settings


_memory_events: dict[int, list[dict]] = defaultdict(list)


class EventStore:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._redis = None
        if self.settings.redis_url != "memory://":
            self._redis = Redis.from_url(self.settings.redis_url, decode_responses=True)

    def append(self, task_id: int, event: str, payload: dict) -> None:
        item = {"event": event, "payload": payload}
        if self._redis:
            self._redis.rpush(self._key(task_id), json.dumps(item, ensure_ascii=False))
            return
        _memory_events[task_id].append(item)

    def read(self, task_id: int, offset: int = 0) -> list[dict]:
        if self._redis:
            raw = self._redis.lrange(self._key(task_id), offset, -1)
            return [json.loads(item) for item in raw]
        return list(_memory_events.get(task_id, []))[offset:]

    @staticmethod
    def _key(task_id: int) -> str:
        return f"task-events:{task_id}"
