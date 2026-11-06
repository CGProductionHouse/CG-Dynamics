import copy
import unittest
from client_copy import validate


class ClientCopyTests(unittest.TestCase):
    def setUp(self):
        self.context = dict(owner_rules=[{'id': 'COPY-02'}], owner_decisions=dict(copy_constraints=[dict(id='full-brand', kind='full_name', short='TBS', full='TBS Brokers', evidence='Direct client correction, 27 October; repeated by owner 5 November')]))
        self.plan = dict(authored_copy=[dict(surface=s, text='Ask TBS Brokers about your cover', source='actual selected layer/file') for s in ('picture', 'cover', 'caption')])

    def test_full_name_and_multiline_group_pass(self):
        self.plan['authored_copy'][0]['text'] = 'ASK TBS\nBROKERS'
        self.assertEqual(validate(self.plan, self.context), [])

    def test_original_rejected_ask_tbs_fails(self):
        self.plan['authored_copy'][0]['text'] = 'ASK TBS'
        self.assertTrue(any('picture' in e for e in validate(self.plan, self.context)))

    def test_one_correct_name_does_not_clear_another_bad_occurrence(self):
        self.plan['authored_copy'][0]['text'] = 'TBS Brokers. Ask TBS!'
        self.assertTrue(validate(self.plan, self.context))

    def test_punctuation_case_and_suffix_are_checked(self):
        for text in ['ask tbs!', 'TBS BROKERSHIP', 'TBS-Brokers']:
            self.plan['authored_copy'][0]['text'] = text
            self.assertTrue(validate(self.plan, self.context), text)

    def test_other_client_is_not_bound_to_this_name(self):
        self.plan['authored_copy'][0]['text'] = 'TBS'
        self.assertEqual(validate(self.plan, {}), [])

    def test_missing_surface_and_source_fail(self):
        self.plan['authored_copy'].pop()
        self.plan['authored_copy'][0].pop('source')
        self.assertGreaterEqual(len(validate(self.plan, self.context)), 2)

    def test_actual_caption_is_checked_and_must_match_inventory(self):
        self.assertTrue(any('actual caption file' in e for e in validate(self.plan, self.context, 'Ask TBS')))
        self.assertTrue(any('differs' in e for e in validate(self.plan, self.context, 'New otherwise valid caption')))

    def test_empty_text_free_cover_is_explicit(self):
        self.plan['authored_copy'][1]['text'] = ''
        self.assertEqual(validate(self.plan, self.context), [])

    def test_unknown_or_unattributed_rules_fail(self):
        for change in [dict(kind='regex'), dict(evidence='')]:
            c = copy.deepcopy(self.context)
            c['owner_decisions']['copy_constraints'][0].update(change)
            self.assertTrue(validate(self.plan, c))

    def test_literal_phrase_does_not_match_inside_other_words(self):
        self.context['owner_decisions']['copy_constraints'] = [dict(id='offer', kind='forbidden_phrase', phrase='free gift', evidence='Offer withdrawn')]
        self.plan['authored_copy'][0]['text'] = 'FREE\nGIFT'
        self.assertTrue(validate(self.plan, self.context))
        self.plan['authored_copy'][0]['text'] = 'Carefree gifting'
        self.assertEqual(validate(self.plan, self.context), [])


if __name__ == '__main__':
    unittest.main()
