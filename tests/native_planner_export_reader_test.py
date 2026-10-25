import copy
import importlib.util
import pathlib
import sys
import unittest

sys.dont_write_bytecode = True

path = pathlib.Path(__file__).resolve().parents[1] / 'scripts' / 'teams-native-export-extract.py'
spec = importlib.util.spec_from_file_location('native_reader', path)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class NativeReaderTest(unittest.TestCase):
    def fixture(self):
        task = {'Task ID': 'task', 'Task Name': 'DP 1', 'Bucket': 'bucket', 'Status': 'Completed', 'Created Date': None,
                'Due date': None, 'Start date': None, 'Is Recurring': None, 'Completed Date': '2026-09-01', 'Notes': None,
                'Assigned To': 'person-id', 'Created By': 'person-id', 'Completed By': 'person-id'}
        combined = {**task, 'Bucket': 'Exact Studio', 'Assigned To': 'Person', 'Created By': 'Person', 'Completed By': 'Person'}
        return {'Plan': [{'Plan ID': 'master', 'Plan name': 'Exact Master', 'Date of export': '2026-10-19'}],
                'Buckets': [{'Bucket ID': 'bucket', 'Bucket Name': 'Exact Studio'}], 'Tasks': [task], 'Consolidated Data': [combined]}

    def test_ids_and_label_sheets_are_joined_not_double_counted(self):
        receipt = reader.normalize_tables(self.fixture(), 'master', 'Exact Master', 'a' * 64)
        self.assertEqual(receipt['task_count'], 1)
        self.assertEqual(receipt['tasks'][0]['Bucket'], 'bucket')
        self.assertIsNone(receipt['tasks'][0]['Due date'])
        self.assertFalse(receipt['apply_ready'])

    def test_missing_duplicate_foreign_or_changed_evidence_refuses(self):
        for case in ['missing', 'duplicate', 'foreign_bucket', 'changed_title', 'changed_plan']:
            tables = copy.deepcopy(self.fixture())
            if case == 'missing': tables['Consolidated Data'] = []
            if case == 'duplicate': tables['Tasks'].append(tables['Tasks'][0])
            if case == 'foreign_bucket': tables['Consolidated Data'][0]['Bucket'] = 'Wrong Branch'
            if case == 'changed_title': tables['Consolidated Data'][0]['Task Name'] = 'Changed'
            if case == 'changed_plan': tables['Plan'][0]['Plan ID'] = 'foreign'
            with self.assertRaises(ValueError):
                reader.normalize_tables(tables, 'master', 'Exact Master', 'a' * 64)


if __name__ == '__main__':
    unittest.main()
