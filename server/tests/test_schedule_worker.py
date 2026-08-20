from datetime import datetime, timezone

from app.services.schedule_worker import next_run_after, process_due_schedules


class DueScheduleRepository:
    def __init__(self, decision="require_approval"):
        self.decision = decision
        self.executions = []
        self.approvals = []

    def list_due_schedules(self, _now):
        return [{"id": "schedule-1", "workspace_id": "workspace-1", "title": "Daily research", "created_by": "user-1", "cron_expression": "* * * * *", "next_run_at": "2026-08-18T10:00:00+00:00"}]

    def policy_decision(self, _workspace_id, _action):
        return self.decision

    def create_schedule_execution(self, schedule_id, workspace_id, scheduled_for, status):
        execution = {"id": "execution-1", "schedule_id": schedule_id, "workspace_id": workspace_id, "scheduled_for": scheduled_for, "status": status}
        self.executions.append(execution)
        return execution

    def create_approval_request(self, user_id, workspace_id, action, summary):
        self.approvals.append((user_id, workspace_id, action, summary))

    def advance_schedule(self, schedule_id, next_run_at):
        self.advanced = (schedule_id, next_run_at)


def test_due_schedule_requires_approval_without_dispatching_external_work():
    repository = DueScheduleRepository()

    result = process_due_schedules(repository, datetime(2026, 8, 18, 10, 0, tzinfo=timezone.utc))

    assert result == {"processed": 1, "pending_approval": 1, "ready": 0, "blocked": 0}
    assert repository.executions == [{"id": "execution-1", "schedule_id": "schedule-1", "workspace_id": "workspace-1", "scheduled_for": "2026-08-18T10:00:00+00:00", "status": "pending_approval"}]
    assert repository.approvals == [("user-1", "workspace-1", "schedule.execute", "Scheduled automation: Daily research")]
    assert repository.advanced == ("schedule-1", "2026-08-18T10:01:00+00:00")


def test_due_schedule_denied_by_policy_is_recorded_as_blocked():
    repository = DueScheduleRepository(decision="deny")

    result = process_due_schedules(repository, datetime(2026, 8, 18, 10, 0, tzinfo=timezone.utc))

    assert result == {"processed": 1, "pending_approval": 0, "ready": 0, "blocked": 1}
    assert repository.executions[0]["status"] == "blocked"
    assert repository.approvals == []


def test_duplicate_due_execution_does_not_create_a_second_approval():
    repository = DueScheduleRepository()
    repository.create_schedule_execution = lambda *_: None

    result = process_due_schedules(repository, datetime(2026, 8, 18, 10, 0, tzinfo=timezone.utc))

    assert result == {"processed": 0, "pending_approval": 0, "ready": 0, "blocked": 0}
    assert repository.approvals == []


def test_five_field_cron_finds_the_next_matching_minute():
    assert next_run_after("15 11 * * *", datetime(2026, 8, 18, 10, 0, tzinfo=timezone.utc)) == "2026-08-18T11:15:00+00:00"
