"""Check saved client copy restrictions against the actual authored-copy inventory.

This is a text guard, not OCR or proof that all rendered artwork was inventoried.
Restrictions belong in the exact client's existing OWNER-DECISIONS.json.
"""
import re


def validate(plan, context, caption=None):
    errors = []
    decisions = context.get('owner_decisions', {})
    constraints = decisions.get('copy_constraints', [])
    required = bool(constraints) or any(r.get('id') == 'COPY-02' for r in context.get('owner_rules', []))
    if not required:
        return errors  # Historical contexts are not retroactively relabelled.
    inventory = plan.get('authored_copy')
    if not isinstance(inventory, list) or not inventory:
        return ['Client copy: inventory actual picture, cover and caption copy before review']
    texts = []
    surfaces = set()
    for item in inventory:
        if not isinstance(item, dict) or item.get('surface') not in ('picture', 'cover', 'caption') or not isinstance(item.get('text'), str) or not item.get('source'):
            errors.append('Client copy: every entry needs surface, text and actual artwork/layer source')
            continue
        surfaces.add(item['surface'])
        texts.append((item['surface'], item['text']))
    if surfaces != {'picture', 'cover', 'caption'}:
        errors.append('Client copy: explicitly inventory picture, cover and caption; empty text may document a text-free surface')
    if caption is not None:
        texts.append(('actual caption file', caption))
        declared = [t for surface, t in texts if surface == 'caption']
        if len(declared) != 1 or declared[0].strip() != caption.strip():
            errors.append('Client copy: actual caption differs from the planned single caption entry')
    if not isinstance(constraints, list):
        return errors + ['Client copy: saved restrictions must be a list']
    for rule in constraints:
        if not isinstance(rule, dict) or not rule.get('id') or not rule.get('evidence'):
            errors.append('Client copy: restriction needs its ID and direct feedback evidence')
            continue
        kind = rule.get('kind')
        if kind == 'full_name':
            short, full = rule.get('short'), rule.get('full')
            if not isinstance(short, str) or not short.strip() or not isinstance(full, str) or full.casefold() == short.casefold() or not full.casefold().startswith(short.casefold() + ' '):
                errors.append('Client copy: invalid full-name restriction')
                continue
            allowed = r'\s+'.join(re.escape(word) for word in full.split())
            forbidden = re.compile(r'(?<!\w)' + re.escape(short) + r'(?!\w)', re.I)
            for surface, text in texts:
                remaining = re.sub(r'(?<!\w)' + allowed + r'(?!\w)', '', text, flags=re.I)
                if forbidden.search(remaining):
                    errors.append(f'Client copy: {rule["id"]} violated on {surface}; use the saved full name')
        elif kind == 'forbidden_phrase':
            phrase = rule.get('phrase')
            if not isinstance(phrase, str) or not phrase.strip():
                errors.append('Client copy: forbidden phrase is empty')
                continue
            pattern = re.compile(r'(?<!\w)' + r'\s+'.join(re.escape(w) for w in phrase.split()) + r'(?!\w)', re.I)
            for surface, text in texts:
                if pattern.search(text):
                    errors.append(f'Client copy: {rule["id"]} violated on {surface}')
        else:
            errors.append('Client copy: unknown saved restriction kind')
    return errors
