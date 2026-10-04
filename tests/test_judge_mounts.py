"""Regression: a Docker volume ancestor must not suppress sandbox bind mounts."""
import logging
import pathlib
import subprocess
import sys
import unittest
from unittest.mock import patch, mock_open

if sys.platform != 'linux':
    raise unittest.SkipTest('Judge runtime requires Linux')

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'judge' / 'core'))
from monitor.monitor_file import MonitorFile

class MountDetectionTest(unittest.TestCase):
    def setUp(self):
        self.monitor = MonitorFile('/judge/workspace/run0', 'cpp', logger=logging.getLogger('test'))

    def test_ancestor_volume_is_not_target_mount(self):
        with patch('subprocess.run', return_value=subprocess.CompletedProcess([], 1)) as run, patch('builtins.open', mock_open(read_data='/dev/vda /judge ext4 rw 0 0\n')):
            self.assertFalse(self.monitor._is_mounted('/judge/workspace/run0/usr'))
            self.assertEqual(run.call_args.args[0], ['findmnt', '--mountpoint', '/judge/workspace/run0/usr'])

    def test_exact_mount_is_detected_in_fallback(self):
        with patch('subprocess.run', side_effect=FileNotFoundError), patch('builtins.open', mock_open(read_data='/dev/vda /judge/workspace/run0/usr ext4 rw 0 0\n')):
            self.assertTrue(self.monitor._is_mounted('/judge/workspace/run0/usr'))

if __name__ == '__main__':
    unittest.main()
