"""Scope owner formats without weakening the default or borrowing client evidence."""
import copy
import tempfile
import unittest
from pathlib import Path
from edit_contract import duration_bounds, sha


class OwnerDuration(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.brief = Path(self.temp.name)/'owner.txt'
        self.brief.write_text('Owner instruction for exact client A: maximum25seconds.', encoding='utf-8')
        self.plan = {'client_id':'client-A','duration_contract':{
            'kind':'owner_assigned_format','client_id':'client-A',
            'authority':'Actual owner instruction, retained with source',
            'evidence':{'path':str(self.brief),'sha256':sha(self.brief)},
            'instruction_excerpt':'maximum25seconds.',
            'minimum_seconds':20,'maximum_seconds':25}}

    def test_default_remains_roughly_thirty(self):
        self.assertEqual(duration_bounds({}), (27,33))
        self.assertFalse(27 <= 13 <= 33)

    def test_exact_owner_format_has_its_own_limits(self):
        lo,hi=duration_bounds(self.plan)
        self.assertTrue(lo <= 24 <= hi)
        self.assertFalse(lo <= 13 <= hi)
        self.assertFalse(lo <= 26 <= hi)

    def test_other_client_cannot_borrow_authority(self):
        self.plan['client_id']='client-B'
        with self.assertRaisesRegex(ValueError,'another or unknown client'):
            duration_bounds(self.plan)

    def test_changed_evidence_and_missing_quote_fail(self):
        original=copy.deepcopy(self.plan)
        self.brief.write_text('Changed brief',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'changed bound file'):
            duration_bounds(self.plan)
        self.plan=original;self.plan['duration_contract']['evidence']['sha256']=sha(self.brief)
        with self.assertRaisesRegex(ValueError,'excerpt missing'):
            duration_bounds(self.plan)

    def test_unbounded_invalid_or_unauthorised_shape_fails(self):
        for value in [True,float('nan'),0,700]:
            p=copy.deepcopy(self.plan);p['duration_contract']['maximum_seconds']=value
            with self.assertRaises(ValueError):duration_bounds(p)
        self.plan['duration_contract']['kind']='editor_shortcut'
        with self.assertRaisesRegex(ValueError,'owner-assigned'):duration_bounds(self.plan)


if __name__=='__main__':unittest.main()
