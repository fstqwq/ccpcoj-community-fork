"""Regression for stale restored cookies after replacing the Web container."""
import logging
import pathlib
import sys
import unittest
from unittest.mock import Mock, patch

if sys.platform != 'linux':
    raise unittest.SkipTest('Judge runtime requires Linux')

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'judge' / 'core'))
try:
    import requests
    from tools.web_client import WebClient
except ImportError:
    requests = None

@unittest.skipIf(requests is None, 'requests is available in the judge runtime')
class ReauthenticationTest(unittest.TestCase):
    def test_relogin_discards_stale_domainless_cookie(self):
        client = WebClient.__new__(WebClient)
        client.config = {'server': {'user_id': 'judger', 'password': 'test-password'}}
        client.logger = logging.getLogger('auth-test')
        client.session = requests.Session()
        client.session.cookies.set('PHPSESSID', 'expired-session')
        client.is_authenticated = False
        client._handle_response = Mock(return_value=True)
        client._save_cookies = Mock()
        def login(method, endpoint, **kwargs):
            self.assertEqual((method, endpoint), ('POST', 'judge_login'))
            self.assertEqual(len(client.session.cookies), 0)
            client.session.cookies.set('PHPSESSID', 'new-session', domain='nginx.local', path='/')
            return {'code': 1, 'data': {'user_id': 'judger'}}
        client._make_request = login
        with patch('tools.web_client.is_debug_enabled', return_value=False):
            self.assertTrue(client._authenticate())
        self.assertTrue(client.is_authenticated)
        self.assertEqual(len(client.session.cookies), 1)
        client._save_cookies.assert_called_once()

if __name__ == '__main__':
    unittest.main()
