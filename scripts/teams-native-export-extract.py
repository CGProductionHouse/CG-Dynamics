"""Read-only native Planner XLSX extraction. Use bundled Python/openpyxl.

No workbook save, provider call, database access or write-back operation exists.
Only a NEW private JSON derivative is written; never put the export in Git.
"""
import datetime
import hashlib
import json
import pathlib
import sys


def normalize_tables(tables, plan_id, plan_name, file_hash, include_details=False):
    plan, buckets = tables['Plan'], tables['Buckets']
    tasks, consolidated = tables['Tasks'], tables['Consolidated Data']
    if len(plan) != 1 or plan[0]['Plan ID'] != plan_id or plan[0]['Plan name'] != plan_name:
        raise ValueError('Wrong exact plan')
    task_map = {t['Task ID']: t for t in tasks}
    combined_map = {t['Task ID']: t for t in consolidated}
    if len(task_map) != len(tasks) or len(combined_map) != len(consolidated) or task_map.keys() != combined_map.keys():
        raise ValueError('Missing or duplicate task identity')
    bucket_map = {b['Bucket ID']: b['Bucket Name'] for b in buckets}
    if len(bucket_map) != len(buckets):
        raise ValueError('Duplicate bucket identity')
    # Tasks contains durable IDs; Consolidated Data resolves those to labels.
    # Never concatenate these two sheets or compare ID cells with display names.
    for task_id, task in task_map.items():
        other = combined_map[task_id]
        if task['Bucket'] not in bucket_map or bucket_map[task['Bucket']] != other['Bucket']:
            raise ValueError('Exact bucket lookup differs')
        if any(task[k] != other[k] for k in task if k not in ['Bucket', 'Assigned To', 'Created By', 'Completed By']):
            raise ValueError('Non-lookup source fields differ')
    def value(v):
        return v.isoformat() if isinstance(v, (datetime.datetime, datetime.date)) else v
    fields = ['Task ID', 'Task Name', 'Bucket', 'Status', 'Created Date', 'Due date', 'Start date', 'Is Recurring', 'Completed Date', 'Notes']
    if include_details:
        fields += ['Completed Checklist Items', 'Checklist Items', 'Labels']
    return {'contract': 'planner_native_export_v1', 'file_sha256': file_hash,
            'plan': {k: value(v) for k, v in plan[0].items()}, 'buckets': buckets,
            'tasks': [{k: value(t[k]) for k in fields} for t in tasks],
            'consolidated_task_identity_and_source_fields_match': True,
            'task_count': len(tasks), 'bucket_count': len(buckets),
            'source': 'Native Teams Planner Export as Excel; downloaded read-only, workbook unchanged',
            'limitations': ['Export dates are source values, not inferred posting dates or timezone facts.',
                            'No ETags in Excel export; freshness and current target guards still required before writes.'],
            'writes': 0, 'apply_ready': False}


def main():
    import openpyxl
    if len(sys.argv) not in [5, 6] or (len(sys.argv) == 6 and sys.argv[5] != '--details'):
        raise ValueError('Expected source, exact plan ID/name, new private output and optional --details')
    source, plan_id, plan_name, output = sys.argv[1:5]
    source, output = pathlib.Path(source).resolve(), pathlib.Path(output).resolve()
    repo = pathlib.Path(__file__).resolve().parent.parent
    if output.exists() or not pathlib.Path(sys.argv[4]).is_absolute() or output == source or repo in output.parents:
        raise ValueError('New absolute private output outside Git required')
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=False)
    try:
        tables = {}
        for name in ['Plan', 'Buckets', 'Tasks', 'Consolidated Data']:
            rows = iter(workbook[name].values)
            headers = next(rows)
            if len(set(headers)) != len(headers):
                raise ValueError('Duplicate headers')
            tables[name] = [dict(zip(headers, row)) for row in rows if any(v is not None for v in row)]
        receipt = normalize_tables(tables, plan_id, plan_name, hashlib.sha256(source.read_bytes()).hexdigest(), len(sys.argv) == 6)
        with output.open('x', encoding='utf-8') as handle:
            json.dump(receipt, handle, ensure_ascii=False, indent=2)
        print(json.dumps({'output': str(output), 'tasks': receipt['task_count'], 'buckets': receipt['bucket_count'],
                          'file_sha256': receipt['file_sha256'], 'writes': 0, 'apply_ready': False}))
    finally:
        workbook.close()


if __name__ == '__main__':
    main()
