"""Run ONLY on an approved same-host runtime with working normal Chromium sandbox.
Never changes browser flags, host settings, sessions or production configuration.
The current restricted cloud browser failure is NOT authorized for retry here.
"""
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect


def run(manifest_path):
    if os.environ.get('NOLAN_APPROVED_SANDBOX_HOST') != '1':
        raise RuntimeError('Requires an independently approved host with a working normal browser sandbox; this flag does not override a denied runtime.')
    path = Path(manifest_path)
    if path.stat().st_mode & 0o077:
        raise RuntimeError('Synthetic account manifest must remain private (0600).')
    manifest = json.loads(path.read_text())
    origin = manifest['origin']
    parsed = urlsplit(origin)
    if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or parsed.path:
        raise RuntimeError('Only exact same-host loopback acceptance is supported.')
    with sync_playwright() as p:
        # Explicit sandbox enabled. No no-sandbox, custom args, CDP attachment,
        # storage-state import, setSession, token injection or downloaded browser.
        executable = os.environ.get('NOLAN_APPROVED_CHROMIUM')
        browser = p.chromium.launch(headless=True, chromium_sandbox=True,
                                    **({'executable_path': executable} if executable else {}))
        try:
            context = browser.new_context(viewport={'width': 1440, 'height': 1000})
            external = []

            def network_guard(route):
                request_url = urlsplit(route.request.url)
                if (request_url.scheme, request_url.netloc) != (parsed.scheme, parsed.netloc):
                    external.append(request_url.scheme + '://' + request_url.netloc)
                    route.abort()
                else:
                    route.continue_()

            context.route('**/*', network_guard)
            page = context.new_page()

            def login(role):
                account = manifest['accounts'][role]
                page.goto(origin + '/login')
                page.get_by_label('Username or email', exact=True).fill(account['email'])
                page.get_by_label('Password', exact=True).fill(account['password'])
                page.get_by_role('button', name='Sign in', exact=True).click()
                page.wait_for_url(lambda url: '/login' not in url, timeout=30000)

            def logout():
                page.get_by_role('button', name='Sign out', exact=True).first.click()
                page.wait_for_url('**/login', timeout=30000)

            login('admin')
            page.goto(origin + '/admin/work?tab=nolan&nolan_view=master')
            expect(page.get_by_role('heading', name='Master schedule', exact=True)).to_be_visible()
            task = page.locator('.nolan-master-task').filter(has_text='Synthetic Master task')
            expect(task).to_have_count(1)
            expect(task).to_contain_text('Canonical owner: Synthetic admin')
            expect(task).to_contain_text('Unknown — no canonical task-level device evidence available.')
            task.get_by_text('Recorded action evidence', exact=True).click()
            expect(task).to_contain_text('synthetic_acceptance_seed')
            page.get_by_label('Search master tasks', exact=True).fill('no-such-synthetic-task')
            expect(page.locator('.nolan-master-task')).to_have_count(0)
            page.get_by_role('button', name='Clear master filters', exact=True).click()
            expect(task).to_have_count(1)
            for width in [390, 1440]:
                page.set_viewport_size({'width': width, 'height': 1000})
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Master viewport overflows'
            # A deliberate failed local API read is not a fabricated success response.
            context.route(origin + '/rest/v1/command_centre_tasks*', lambda route: route.abort())
            page.get_by_role('button', name='Refresh status', exact=True).click()
            expect(task).to_contain_text('status is last-known')
            context.unroute(origin + '/rest/v1/command_centre_tasks*')
            page.get_by_role('button', name='Refresh status', exact=True).click()
            expect(page.get_by_text('Task source read completed.', exact=False)).to_be_visible()
            page.reload()
            expect(task).to_have_count(1)
            page.get_by_role('navigation', name='Work views').get_by_role('button', name='Active work', exact=True).click()
            page.go_back()
            expect(page.get_by_role('heading', name='Master schedule', exact=True)).to_be_visible()
            page.get_by_role('navigation', name='Work views').get_by_role('button', name='Needs You', exact=True).click()
            if manifest['decisions']:
                def scenario(action):
                    # Private fixture administration, never app session/auth injection.
                    response = context.request.post(origin + '/__nolan_acceptance/scenario',
                                                    headers={'x-nolan-fixture-control': manifest['fixtureControl']},
                                                    data={'action': action})
                    assert response.status == 204, 'Isolated scenario failed'

                def prepare_question(question):
                    page.get_by_label('Native Dynamics task UUID', exact=True).fill(manifest['taskId'])
                    page.get_by_role('button', name='Read source and eligible recipients', exact=True).click()
                    page.get_by_label('Named recipient', exact=True).select_option(manifest['accounts']['manager']['id'])
                    page.get_by_label('Question', exact=True).fill(question)

                endpoint = origin + '/rest/v1/rpc/create_nolan_decision_request'
                attempts = []
                first_receipt = []

                def lose_first_receipt(route):
                    attempts.append(route.request.post_data_json['p_idempotency_key'])
                    if len(attempts) == 1:
                        # Real RPC commits; only delivery of its response is interrupted.
                        response = route.fetch()
                        assert response.status == 200, 'First genuine creation must commit'
                        first_receipt.append(response.json())
                        route.abort()
                    else:
                        route.continue_()

                context.route(endpoint, lose_first_receipt)
                prepare_question('Synthetic same-origin browser question')
                page.get_by_role('button', name='Send internal decision request', exact=True).click()
                expect(page.get_by_label('Native Dynamics task UUID', exact=True)).to_be_disabled()
                expect(page.get_by_label('Question', exact=True)).to_be_disabled()
                page.get_by_role('button', name='Send internal decision request', exact=True).click()
                expect(page.get_by_text('Request recorded: ' + first_receipt[0], exact=True)).to_be_visible()
                assert len(attempts) == 2 and attempts[0] == attempts[1], 'Uncertain retry must preserve its exact key'
                expect(page.get_by_text('Synthetic same-origin browser question', exact=True)).to_have_count(1)
                context.unroute(endpoint)
                logout()
                login('manager')
                page.goto(origin + '/admin/work?tab=nolan&nolan_view=decisions')
                expect(page.get_by_text('Synthetic same-origin browser question', exact=True)).to_be_visible()
                page.get_by_label('Response', exact=True).fill('Synthetic response only')
                page.get_by_role('button', name='Record response only', exact=True).click()
                expect(page.get_by_text('Response recorded; no task change applied.', exact=True)).to_be_visible()
                logout()
                login('admin')
                page.goto(origin + '/admin/work?tab=nolan&nolan_view=decisions')
                prepare_question('Synthetic stale-create question')
                scenario('advance-source')
                page.get_by_role('button', name='Send internal decision request', exact=True).click()
                decisions = page.locator('section[aria-label="Explicit decision requests"]')
                expect(decisions.get_by_role('alert')).to_be_visible()
                expect(page.get_by_text('Request recorded:', exact=False)).to_have_count(0)
                prepare_question('Synthetic stale-response question')
                page.get_by_role('button', name='Send internal decision request', exact=True).click()
                expect(page.get_by_text('Request recorded:', exact=False)).to_be_visible()
                scenario('advance-source')
                logout()
                login('manager')
                page.goto(origin + '/admin/work?tab=nolan&nolan_view=decisions')
                expect(page.get_by_text('Synthetic stale-response question', exact=True)).to_be_visible()
                expect(page.get_by_text('Source changed or recipient unavailable.', exact=False)).to_be_visible()
                expect(page.get_by_role('button', name='Record response only', exact=True)).to_have_count(0)
                scenario('revoke-manager')
                page.get_by_role('button', name='Refresh requests', exact=True).click()
                expect(page.locator('section[aria-label="Explicit decision requests"]').get_by_role('alert')).to_be_visible()
                expect(page.get_by_text('Synthetic stale-response question', exact=True)).to_have_count(0)
                page.get_by_role('navigation', name='Work views').get_by_role('button', name='Master schedule', exact=True).click()
                page.get_by_role('button', name='Refresh status', exact=True).click()
                expect(page.locator('.native-error')).to_contain_text('Current account authorization changed')
                expect(page.locator('.nolan-master-task')).to_have_count(0)
                scenario('restore-manager')
                page.get_by_role('button', name='Refresh status', exact=True).click()
                expect(page.get_by_text('Task source read completed.', exact=False)).to_be_visible()
                page.get_by_role('navigation', name='Work views').get_by_role('button', name='Needs You', exact=True).click()
                expect(page.get_by_text('Synthetic stale-response question', exact=True)).to_be_visible()
            else:
                expect(page.get_by_text('Needs You is not activated.', exact=False)).to_be_visible()
            logout()
            for role in ['staff', 'client']:
                login(role)
                page.goto(origin + '/admin/work?tab=nolan&nolan_view=master')
                if role == 'staff':
                    expect(page.get_by_role('heading', name='Work', exact=True)).to_be_visible()
                else:
                    page.wait_for_url('**/client**', timeout=30000)
                expect(page.get_by_label('Nolan overview', exact=True)).to_have_count(0)
                if role == 'staff':
                    logout()
            assert not external, 'Actual app attempted an external request; review CSP/scope before acceptance'
            print(json.dumps({'result': 'passed', 'scope': 'same-origin actual-app synthetic sign-in/Master/role/decision flows',
                              'widths': [390, 1440], 'physical_device': False,
                              'remaining': ['physical device', 'production release acceptance']}))
        finally:
            browser.close()


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 scripts/nolan-same-origin-browser.py PRIVATE_MANIFEST_PATH')
    run(sys.argv[1])
