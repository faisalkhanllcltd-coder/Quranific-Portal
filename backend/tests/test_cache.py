from django.core.cache import cache
def test_cache_round_trip():
    cache.set('healthcheck', 'ok')
    assert cache.get('healthcheck') == 'ok'

