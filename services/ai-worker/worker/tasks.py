from worker.celery_app import celery_app


@celery_app.task(name="system.ping", bind=True, max_retries=0)
def system_ping(self) -> dict[str, str]:
    return {"status": "ok", "task_id": self.request.id or ""}


@celery_app.task(name="ai.demo_quality_check", bind=True, max_retries=0)
def demo_quality_check(self, job_id: str) -> dict[str, str]:
    from worker.demo_jobs import run_demo_job

    run_demo_job(job_id)
    return {"status": "processed", "task_id": self.request.id or "", "job_id": job_id}
