"""Safe schedule processing control plane.

This module intentionally records policy-gated work only. A separate, isolated
executor may consume ``ready`` executions after a deployment enables it.
"""
from datetime import timedelta


def _field_matches(value, expression, minimum, maximum):
    for part in expression.split(","):
        base, separator, step = part.partition("/")
        stride = int(step) if separator and step.isdigit() else 1
        if base == "*":
            if (value - minimum) % stride == 0:
                return True
            continue
        if "-" in base:
            start, end = (int(item) for item in base.split("-", 1))
            if start <= value <= end and (value - start) % stride == 0:
                return True
            continue
        if base.isdigit() and minimum <= int(base) <= maximum and value == int(base):
            return True
    return False


def next_run_after(cron_expression, now):
    """Return the next matching minute for the supported standard five-field cron."""
    fields = cron_expression.split()
    if len(fields) != 5:
        raise ValueError("Schedules require a five-field cron expression")
    candidate = now.replace(second=0, microsecond=0) + timedelta(minutes=1)
    for _ in range(366 * 24 * 60):
        minute, hour, day, month, weekday = fields
        if (
            _field_matches(candidate.minute, minute, 0, 59)
            and _field_matches(candidate.hour, hour, 0, 23)
            and _field_matches(candidate.day, day, 1, 31)
            and _field_matches(candidate.month, month, 1, 12)
            and _field_matches((candidate.weekday() + 1) % 7, weekday, 0, 6)
        ):
            return candidate.isoformat()
        candidate += timedelta(minutes=1)
    raise ValueError("Cron expression has no next occurrence within one year")


def process_due_schedules(repository, now):
    """Persist one non-dispatched execution for every currently due schedule."""
    counts = {"processed": 0, "pending_approval": 0, "ready": 0, "blocked": 0}
    for schedule in repository.list_due_schedules(now):
        decision = repository.policy_decision(schedule["workspace_id"], "schedule.execute")
        status = {"allow": "ready", "deny": "blocked"}.get(decision, "pending_approval")
        execution = repository.create_schedule_execution(
            schedule["id"], schedule["workspace_id"], schedule["next_run_at"], status
        )
        if not execution:
            continue
        counts["processed"] += 1
        counts[status] += 1
        if status == "pending_approval":
            repository.create_approval_request(
                schedule["created_by"],
                schedule["workspace_id"],
                "schedule.execute",
                f"Scheduled automation: {schedule['title']}",
            )
        repository.advance_schedule(
            schedule["id"], next_run_after(schedule["cron_expression"], now)
        )
    return counts
